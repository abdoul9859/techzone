#!/usr/bin/env python3
"""
Migration: Ajouter les colonnes external_price et external_profit à la table invoice_items
"""

import os
import sys
from pathlib import Path

# Ajouter le répertoire racine au PYTHONPATH
root_dir = Path(__file__).parent
sys.path.insert(0, str(root_dir))

from sqlalchemy import text, inspect
from app.database import engine, SessionLocal

def migrate():
    """Ajouter les colonnes external_price et external_profit si elles n'existent pas"""
    db = SessionLocal()
    try:
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('invoice_items')]
        
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
        
        print("✅ Migration terminée avec succès")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Erreur lors de la migration: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    migrate()

