#!/usr/bin/env python3
"""Script pour ajouter les colonnes external_price et external_profit"""

from app.database import engine, SessionLocal
from sqlalchemy import text, inspect

def add_columns():
    db = SessionLocal()
    try:
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('invoice_items')]
        
        print(f"Colonnes actuelles: {columns}")
        
        # Ajouter external_price si elle n'existe pas
        if 'external_price' not in columns:
            print("Ajout de la colonne external_price...")
            db.execute(text("ALTER TABLE invoice_items ADD COLUMN external_price NUMERIC(10, 2)"))
            db.commit()
            print("✅ Colonne external_price ajoutée")
        else:
            print("ℹ️ Colonne external_price existe déjà")
        
        # Ajouter external_profit si elle n'existe pas
        if 'external_profit' not in columns:
            print("Ajout de la colonne external_profit...")
            db.execute(text("ALTER TABLE invoice_items ADD COLUMN external_profit NUMERIC(12, 2)"))
            db.commit()
            print("✅ Colonne external_profit ajoutée")
        else:
            print("ℹ️ Colonne external_profit existe déjà")
        
        # Vérifier
        inspector = inspect(engine)
        columns_after = [col['name'] for col in inspector.get_columns('invoice_items')]
        print(f"Colonnes après migration: {columns_after}")
        print(f"external_price existe: {'external_price' in columns_after}")
        print(f"external_profit existe: {'external_profit' in columns_after}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Erreur lors de la migration: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()
    
    return True

if __name__ == "__main__":
    success = add_columns()
    exit(0 if success else 1)

