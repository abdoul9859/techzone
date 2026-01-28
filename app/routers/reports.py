from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_, case
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, date as dt_date
import json

from ..database import get_db, User
from ..database import (
    Invoice, InvoiceItem, InvoicePayment, Quotation, Product, ProductVariant, 
    Client, Supplier, SupplierInvoice, DailyPurchase, BankTransaction,
    StockMovement, Maintenance
)
from ..auth import get_current_user

router = APIRouter(prefix="/api/reports", tags=["reports"])

# Helper functions
def parse_date(date_str: Optional[str]) -> Optional[dt_date]:
    """Parse date string to date object"""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except:
        return None

def get_period_dates(period: str = "month", start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Calculate period start and end dates"""
    today = datetime.now().date()
    
    if period == "custom" and start_date and end_date:
        start = parse_date(start_date) or today
        end = parse_date(end_date) or today
    elif period == "today":
        start = end = today
    elif period == "week":
        start = today - timedelta(days=7)
        end = today
    elif period == "month":
        start = today.replace(day=1)
        end = today
    elif period == "quarter":
        quarter_start_month = ((today.month - 1) // 3) * 3 + 1
        start = today.replace(month=quarter_start_month, day=1)
        end = today
    elif period == "year":
        start = today.replace(month=1, day=1)
        end = today
    else:
        start = today.replace(day=1)
        end = today
    
    return start, end

def calculate_previous_period(start: dt_date, end: dt_date):
    """Calculate the previous period of same duration"""
    duration = (end - start).days
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=duration)
    return prev_start, prev_end


@router.get("/overview")
async def get_overview_report(
    period: str = Query("month", description="Period type: today, week, month, quarter, year, custom"),
    start_date: Optional[str] = Query(None, description="Start date for custom period (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for custom period (YYYY-MM-DD)"),
    compare_previous: bool = Query(False, description="Compare with previous period"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Comprehensive overview report with all KPIs"""
    try:
        start, end = get_period_dates(period, start_date, end_date)
        
        # Initialize response
        result = {
            "period": {"start": str(start), "end": str(end), "type": period},
            "kpis": {},
            "comparison": None
        }
        
        # Calculate KPIs for current period
        try:
            result["kpis"] = await _calculate_overview_kpis(db, start, end)
        except Exception as kpi_error:
            import traceback
            print(f"ERROR in _calculate_overview_kpis: {str(kpi_error)}")
            print(traceback.format_exc())
            # Return minimal data on error
            result["kpis"] = {
                "revenue": {"total": 0, "count": 0, "average_ticket": 0},
                "error": str(kpi_error)
            }
        
        # Calculate comparison if requested
        if compare_previous:
            prev_start, prev_end = calculate_previous_period(start, end)
            prev_kpis = await _calculate_overview_kpis(db, prev_start, prev_end)
            result["comparison"] = {
                "period": {"start": str(prev_start), "end": str(prev_end)},
                "kpis": prev_kpis,
                "changes": _calculate_changes(result["kpis"], prev_kpis)
            }
        
        return result
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in get_overview_report: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))


async def _calculate_overview_kpis(db: Session, start: dt_date, end: dt_date) -> Dict[str, Any]:
    """Calculate all KPIs for a given period"""
    
    # Paid invoice statuses (FR/EN)
    paid_statuses = ["payée", "Payée", "PAID", "paid", "Paid"]
    
    # Revenue (paid invoices only)
    revenue_result = db.query(
        func.coalesce(func.sum(Invoice.total), 0).label("total"),
        func.count(Invoice.invoice_id).label("count")
    ).filter(
        Invoice.date.between(start, end),
        Invoice.status.in_(paid_statuses)
    ).first()
    
    total_revenue = float(revenue_result.total or 0)
    invoice_count = int(revenue_result.count or 0)
    
    # Average ticket
    avg_ticket = total_revenue / invoice_count if invoice_count > 0 else 0
    
    # Total purchases (supplier invoices + daily purchases)
    supplier_purchases = float(db.query(
        func.coalesce(func.sum(SupplierInvoice.amount), 0)
    ).filter(
        SupplierInvoice.invoice_date.between(start, end)
    ).scalar() or 0)
    
    daily_purchases = float(db.query(
        func.coalesce(func.sum(DailyPurchase.amount), 0)
    ).filter(
        DailyPurchase.date.between(start, end)
    ).scalar() or 0)
    
    total_purchases = supplier_purchases + daily_purchases
    
    # Net profit
    net_profit = total_revenue - total_purchases
    profit_margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
    
    # Quote conversion rate
    quote_count = db.query(func.count(Quotation.quotation_id)).filter(
        Quotation.date.between(start, end)
    ).scalar() or 0
    
    converted_quotes = db.query(func.count(func.distinct(Invoice.quotation_id))).filter(
        Invoice.quotation_id.isnot(None),
        Invoice.date.between(start, end)
    ).scalar() or 0
    
    conversion_rate = (converted_quotes / quote_count * 100) if quote_count > 0 else 0
    
    # Client debts - Get all unpaid/partially paid invoices
    unpaid_invoices = db.query(Invoice).filter(
        Invoice.status.notin_(paid_statuses + ["annulée", "Annulée", "cancelled", "Cancelled", "draft", "Draft"])
    ).all()
    
    client_debts = 0.0
    for inv in unpaid_invoices:
        total_paid = db.query(func.coalesce(func.sum(InvoicePayment.amount), 0)).filter(
            InvoicePayment.invoice_id == inv.invoice_id
        ).scalar() or 0
        client_debts += float(inv.total or 0) - float(total_paid)
    
    # Supplier debts
    supplier_debts = float(db.query(
        func.coalesce(func.sum(SupplierInvoice.amount - SupplierInvoice.paid_amount), 0)
    ).filter(
        SupplierInvoice.status.in_(["pending", "partial", "overdue"])
    ).scalar() or 0)
    
    # Stock metrics
    total_products = db.query(func.count(Product.product_id)).filter(
        Product.is_archived == False
    ).scalar() or 0
    
    out_of_stock = db.query(func.count(Product.product_id)).filter(
        Product.is_archived == False,
        or_(Product.quantity == 0, Product.quantity.is_(None))
    ).scalar() or 0
    
    low_stock = db.query(func.count(Product.product_id)).filter(
        Product.is_archived == False,
        Product.quantity > 0,
        Product.quantity <= 3
    ).scalar() or 0
    
    # Calculate total stock value
    products = db.query(Product).filter(Product.is_archived == False).all()
    total_stock_value = 0.0
    
    for product in products:
        has_variants = db.query(ProductVariant.variant_id).filter(
            ProductVariant.product_id == product.product_id
        ).first() is not None
        
        if has_variants:
            available_count = db.query(func.count(ProductVariant.variant_id)).filter(
                ProductVariant.product_id == product.product_id,
                ProductVariant.is_sold == False
            ).scalar() or 0
            total_stock_value += available_count * float(product.price or 0)
        else:
            qty = int(product.quantity or 0)
            total_stock_value += qty * float(product.price or 0)
    
    # Active clients (clients with invoices in period)
    active_clients = db.query(func.count(func.distinct(Invoice.client_id))).filter(
        Invoice.client_id.isnot(None),
        Invoice.date.between(start, end)
    ).scalar() or 0
    
    # Total clients
    total_clients = db.query(func.count(Client.client_id)).scalar() or 0
    
    # Transaction count
    transaction_count = invoice_count
    
    return {
        "revenue": {
            "total": round(total_revenue, 2),
            "count": invoice_count,
            "average_ticket": round(avg_ticket, 2)
        },
        "purchases": {
            "total": round(total_purchases, 2),
            "supplier_invoices": round(supplier_purchases, 2),
            "daily_purchases": round(daily_purchases, 2)
        },
        "profit": {
            "net": round(net_profit, 2),
            "margin_percent": round(profit_margin, 2)
        },
        "conversion": {
            "quotes_total": quote_count,
            "quotes_converted": converted_quotes,
            "rate_percent": round(conversion_rate, 2)
        },
        "debts": {
            "clients": round(client_debts, 2),
            "suppliers": round(supplier_debts, 2)
        },
        "stock": {
            "total_products": total_products,
            "out_of_stock": out_of_stock,
            "low_stock": low_stock,
            "total_value": round(total_stock_value, 2)
        },
        "clients": {
            "total": total_clients,
            "active_in_period": active_clients
        },
        "transactions": {
            "count": transaction_count
        }
    }


def _calculate_changes(current: Dict, previous: Dict) -> Dict:
    """Calculate percentage changes between two periods"""
    changes = {}
    
    def calc_change(curr_val, prev_val):
        if prev_val == 0:
            return 100.0 if curr_val > 0 else 0.0
        return round(((curr_val - prev_val) / prev_val) * 100, 2)
    
    # Revenue changes
    changes["revenue_change"] = calc_change(
        current["revenue"]["total"],
        previous["revenue"]["total"]
    )
    
    # Profit changes
    changes["profit_change"] = calc_change(
        current["profit"]["net"],
        previous["profit"]["net"]
    )
    
    # Transaction changes
    changes["transaction_change"] = calc_change(
        current["transactions"]["count"],
        previous["transactions"]["count"]
    )
    
    return changes


@router.get("/sales")
async def get_sales_report(
    period: str = Query("month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Detailed sales report"""
    try:
        start, end = get_period_dates(period, start_date, end_date)
        paid_statuses = ["payée", "Payée", "PAID", "paid", "Paid"]
        
        # Get all paid invoices in period
        invoices = db.query(Invoice).filter(
            Invoice.date.between(start, end),
            Invoice.status.in_(paid_statuses)
        ).all()
        
        # Calculate daily sales
        daily_sales = {}
        for invoice in invoices:
            day = str(invoice.date)
            if day not in daily_sales:
                daily_sales[day] = {"revenue": 0.0, "count": 0}
            daily_sales[day]["revenue"] += float(invoice.total or 0)
            daily_sales[day]["count"] += 1
        
        # Top clients
        top_clients = db.query(
            Client.name,
            func.count(Invoice.invoice_id).label("order_count"),
            func.sum(Invoice.total).label("total_revenue")
        ).join(
            Invoice, Invoice.client_id == Client.client_id
        ).filter(
            Invoice.date.between(start, end),
            Invoice.status.in_(paid_statuses)
        ).group_by(Client.client_id).order_by(desc("total_revenue")).limit(10).all()
        
        # Top products
        top_products = db.query(
            InvoiceItem.product_name,
            func.sum(InvoiceItem.quantity).label("quantity"),
            func.sum(InvoiceItem.total).label("revenue")
        ).join(
            Invoice, Invoice.invoice_id == InvoiceItem.invoice_id
        ).filter(
            Invoice.date.between(start, end),
            Invoice.status.in_(paid_statuses)
        ).group_by(InvoiceItem.product_name).order_by(desc("revenue")).limit(10).all()
        
        # Payment methods
        payment_methods = db.query(
            InvoicePayment.payment_method,
            func.count(InvoicePayment.payment_id).label("count"),
            func.sum(InvoicePayment.amount).label("total")
        ).filter(
            InvoicePayment.payment_date.between(start, end)
        ).group_by(InvoicePayment.payment_method).all()
        
        return {
            "period": {"start": str(start), "end": str(end)},
            "summary": {
                "total_revenue": sum(v["revenue"] for v in daily_sales.values()),
                "invoice_count": sum(v["count"] for v in daily_sales.values()),
                "avg_daily_revenue": sum(v["revenue"] for v in daily_sales.values()) / len(daily_sales) if daily_sales else 0
            },
            "daily_sales": [
                {"date": k, "revenue": v["revenue"], "count": v["count"]}
                for k, v in sorted(daily_sales.items())
            ],
            "top_clients": [
                {"name": name, "orders": int(count), "revenue": float(revenue)}
                for name, count, revenue in top_clients
            ],
            "top_products": [
                {"name": name, "quantity": int(qty), "revenue": float(rev)}
                for name, qty, rev in top_products
            ],
            "payment_methods": [
                {"method": method or "Non spécifié", "count": int(count), "total": float(total)}
                for method, count, total in payment_methods
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/purchases")
async def get_purchases_report(
    period: str = Query("month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Detailed purchases report (supplier invoices + daily purchases)"""
    try:
        start, end = get_period_dates(period, start_date, end_date)
        
        # Supplier invoices
        supplier_invoices_data = db.query(
            Supplier.name.label("supplier_name"),
            func.count(SupplierInvoice.invoice_id).label("count"),
            func.sum(SupplierInvoice.amount).label("total")
        ).join(
            Supplier, Supplier.supplier_id == SupplierInvoice.supplier_id
        ).filter(
            SupplierInvoice.invoice_date.between(start, end)
        ).group_by(Supplier.supplier_id).order_by(desc("total")).all()
        
        # Daily purchases
        daily_purchases_data = db.query(
            func.date(DailyPurchase.date).label("date"),
            func.count(DailyPurchase.purchase_id).label("count"),
            func.sum(DailyPurchase.amount).label("total")
        ).filter(
            DailyPurchase.date.between(start, end)
        ).group_by(func.date(DailyPurchase.date)).all()
        
        total_supplier = sum(float(total or 0) for _, _, total in supplier_invoices_data)
        total_daily = sum(float(total or 0) for _, _, total in daily_purchases_data)
        
        return {
            "period": {"start": str(start), "end": str(end)},
            "summary": {
                "total_purchases": total_supplier + total_daily,
                "supplier_invoices": total_supplier,
                "daily_purchases": total_daily
            },
            "top_suppliers": [
                {"name": name, "invoice_count": int(count), "total": float(total)}
                for name, count, total in supplier_invoices_data
            ],
            "daily_breakdown": [
                {"date": str(date), "count": int(count), "total": float(total)}
                for date, count, total in daily_purchases_data
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stock")
async def get_stock_report(
    period: str = Query("month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Stock report with movements"""
    try:
        start, end = get_period_dates(period, start_date, end_date)
        
        # Stock movements in period
        movements = db.query(
            StockMovement.movement_type,
            func.count(StockMovement.movement_id).label("count"),
            func.sum(StockMovement.quantity).label("quantity")
        ).filter(
            StockMovement.date.between(start, end)
        ).group_by(StockMovement.movement_type).all()
        
        # Current stock status
        products = db.query(Product).filter(Product.is_archived == False).all()
        
        stock_by_category = {}
        total_value = 0.0
        
        for product in products:
            category = product.category or "Non catégorisé"
            if category not in stock_by_category:
                stock_by_category[category] = {"products": 0, "quantity": 0, "value": 0.0}
            
            has_variants = db.query(ProductVariant.variant_id).filter(
                ProductVariant.product_id == product.product_id
            ).first() is not None
            
            if has_variants:
                qty = db.query(func.count(ProductVariant.variant_id)).filter(
                    ProductVariant.product_id == product.product_id,
                    ProductVariant.is_sold == False
                ).scalar() or 0
            else:
                qty = int(product.quantity or 0)
            
            value = qty * float(product.price or 0)
            stock_by_category[category]["products"] += 1
            stock_by_category[category]["quantity"] += qty
            stock_by_category[category]["value"] += value
            total_value += value
        
        return {
            "period": {"start": str(start), "end": str(end)},
            "movements": [
                {"type": mov_type, "count": int(count), "quantity": int(qty)}
                for mov_type, count, qty in movements
            ],
            "current_stock": {
                "total_value": round(total_value, 2),
                "by_category": {
                    cat: {
                        "products": data["products"],
                        "quantity": data["quantity"],
                        "value": round(data["value"], 2)
                    }
                    for cat, data in stock_by_category.items()
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/finance")
async def get_finance_report(
    period: str = Query("month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Financial report with bank transactions"""
    try:
        start, end = get_period_dates(period, start_date, end_date)
        
        # Bank transactions
        transactions = db.query(BankTransaction).filter(
            BankTransaction.date.between(start, end)
        ).all()
        
        total_income = sum(float(t.amount) for t in transactions if t.type == "entree")
        total_expense = sum(float(t.amount) for t in transactions if t.type == "sortie")
        net_balance = total_income - total_expense
        
        # Daily balance
        daily_balance = {}
        running_balance = 0.0
        
        for t in sorted(transactions, key=lambda x: x.date):
            day = str(t.date)
            if t.type == "entree":
                running_balance += float(t.amount)
            else:
                running_balance -= float(t.amount)
            daily_balance[day] = running_balance
        
        return {
            "period": {"start": str(start), "end": str(end)},
            "summary": {
                "total_income": round(total_income, 2),
                "total_expense": round(total_expense, 2),
                "net_balance": round(net_balance, 2)
            },
            "daily_balance": [
                {"date": date, "balance": round(balance, 2)}
                for date, balance in sorted(daily_balance.items())
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/maintenance")
async def get_maintenance_report(
    period: str = Query("month"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Maintenance report"""
    try:
        start, end = get_period_dates(period, start_date, end_date)
        
        # Maintenances in period
        maintenances = db.query(Maintenance).filter(
            Maintenance.created_at.between(
                datetime.combine(start, datetime.min.time()),
                datetime.combine(end, datetime.max.time())
            )
        ).all()
        
        # Group by status
        by_status = {}
        total_revenue = 0.0
        
        for m in maintenances:
            status = m.status or "inconnu"
            if status not in by_status:
                by_status[status] = {"count": 0, "revenue": 0.0}
            by_status[status]["count"] += 1
            by_status[status]["revenue"] += float(m.total_price or 0)
            total_revenue += float(m.total_price or 0)
        
        return {
            "period": {"start": str(start), "end": str(end)},
            "summary": {
                "total_count": len(maintenances),
                "total_revenue": round(total_revenue, 2)
            },
            "by_status": {
                status: {
                    "count": data["count"],
                    "revenue": round(data["revenue"], 2)
                }
                for status, data in by_status.items()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Keep existing endpoints for backward compatibility
@router.get("/dashboard")
async def get_dashboard_metrics(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Legacy dashboard endpoint"""
    return await get_overview_report(
        period="custom",
        start_date=str((datetime.now() - timedelta(days=days)).date()),
        end_date=str(datetime.now().date()),
        current_user=current_user,
        db=db
    )

@router.get("/stock-summary")
async def get_stock_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Legacy stock summary endpoint"""
    return await get_stock_report(
        period="month",
        current_user=current_user,
        db=db
    )
