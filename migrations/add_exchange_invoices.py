#!/usr/bin/env python3
"""
Migration: Ajouter le support des factures d'échange
- Ajoute la colonne invoice_type à la table invoices
- Crée la table invoice_exchange_items
"""
import os
import sys
from pathlib import Path

# Ajouter le répertoire parent au path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

# Récupérer l'URL de la base de données
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./techzone.db")

# Normaliser l'URL pour SQLAlchemy
if DATABASE_URL.startswith("sqlite:///"):
    # Pour SQLite, utiliser le chemin relatif ou absolu
    db_path = DATABASE_URL.replace("sqlite:///", "")
    if not os.path.isabs(db_path):
        # Chemin relatif depuis le répertoire du projet
        db_path = os.path.join(os.path.dirname(__file__), "..", db_path)
    DATABASE_URL = f"sqlite:///{os.path.abspath(db_path)}"
elif DATABASE_URL.startswith("sqlite://"):
    # Format sqlite:///path/to/db
    pass
else:
    # PostgreSQL ou autre
    pass

def run_migration():
    """Exécute les migrations pour les factures d'échange"""
    engine = create_engine(DATABASE_URL, echo=False)
    
    with engine.connect() as conn:
        inspector = inspect(engine)
        
        # Vérifier si la colonne invoice_type existe déjà
        try:
            columns = [col['name'] for col in inspector.get_columns('invoices')]
            if 'invoice_type' not in columns:
                print("📝 Ajout de la colonne invoice_type à la table invoices...")
                conn.execute(text("ALTER TABLE invoices ADD COLUMN invoice_type VARCHAR(20) DEFAULT 'normal'"))
                conn.commit()
                print("✅ Colonne invoice_type ajoutée avec succès")
            else:
                print("ℹ️  La colonne invoice_type existe déjà")
        except Exception as e:
            print(f"⚠️  Erreur lors de la vérification/ajout de invoice_type: {e}")
            # Si la table n'existe pas encore, elle sera créée par SQLAlchemy
            pass
        
        # Vérifier si la table invoice_exchange_items existe déjà
        try:
            tables = inspector.get_table_names()
            if 'invoice_exchange_items' not in tables:
                print("📝 Création de la table invoice_exchange_items...")
                # SQLite
                if 'sqlite' in DATABASE_URL.lower():
                    conn.execute(text("""
                        CREATE TABLE invoice_exchange_items (
                            exchange_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
                            invoice_id INTEGER NOT NULL,
                            product_id INTEGER,
                            product_name VARCHAR(100) NOT NULL,
                            quantity INTEGER NOT NULL,
                            variant_id INTEGER,
                            variant_imei VARCHAR(255),
                            notes TEXT,
                            FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE,
                            FOREIGN KEY (product_id) REFERENCES products(product_id),
                            FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id)
                        )
                    """))
                else:
                    # PostgreSQL
                    conn.execute(text("""
                        CREATE TABLE invoice_exchange_items (
                            exchange_item_id SERIAL PRIMARY KEY,
                            invoice_id INTEGER NOT NULL,
                            product_id INTEGER,
                            product_name VARCHAR(100) NOT NULL,
                            quantity INTEGER NOT NULL,
                            variant_id INTEGER,
                            variant_imei VARCHAR(255),
                            notes TEXT,
                            FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE,
                            FOREIGN KEY (product_id) REFERENCES products(product_id),
                            FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id)
                        )
                    """))
                conn.commit()
                print("✅ Table invoice_exchange_items créée avec succès")
            else:
                print("ℹ️  La table invoice_exchange_items existe déjà")
        except Exception as e:
            print(f"⚠️  Erreur lors de la création de invoice_exchange_items: {e}")
            # Vérifier si c'est juste que la table existe déjà
            try:
                inspector.get_table_names()
                if 'invoice_exchange_items' in inspector.get_table_names():
                    print("ℹ️  La table invoice_exchange_items existe déjà")
                else:
                    raise e
            except:
                raise e
        
        print("\n✅ Migration terminée avec succès!")

if __name__ == "__main__":
    try:
        run_migration()
    except Exception as e:
        print(f"❌ Erreur lors de la migration: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

