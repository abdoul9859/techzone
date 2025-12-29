# TECHZONE - Gestion de Stock

Application de gestion de stock et facturation développée avec **FastAPI** et **Bootstrap**.

## 🚀 Fonctionnalités

### ✅ Gestion des Produits
- **Système de variantes** : Produits avec variantes (smartphones, ordinateurs, etc.)
- **Codes-barres intelligents** : Gestion selon la règle métier
- **IMEI/Numéros de série** : Traçabilité complète des variantes
- **Attributs spécifiques** : Couleur, stockage, etc. par variante
- **Recherche avancée** : Par nom, marque, modèle, codes-barres

### ✅ Gestion des Clients
- Informations complètes (contact, adresse, etc.)
- Recherche et filtres
- Historique des transactions

### ✅ Mouvements de Stock
- **Traçabilité complète** : Entrées, sorties, ventes, retours
- **Audit automatique** : Logs lors des suppressions
- **Statistiques temps réel** : Mouvements du jour, totaux

### ✅ Facturation
- **Devis** : Création, conversion en factures
- **Factures** : Gestion complète avec paiements
- **Bons de livraison** : Suivi des livraisons
- **Statistiques** : Chiffre d'affaires, impayés

### ✅ Authentification & Sécurité
- **JWT** : Authentification sécurisée
- **Rôles** : Admin, Manager, Utilisateur
- **Permissions** : Contrôle d'accès granulaire

## 🛠️ Technologies

- **Backend** : FastAPI, SQLAlchemy, SQLite
- **Frontend** : Bootstrap 5, JavaScript ES6+
- **Authentification** : JWT avec python-jose
- **Base de données** : SQLite (développement), PostgreSQL (production)
- **Déploiement** : Docker, Caddy (reverse proxy avec HTTPS automatique)

## 📦 Installation

### Avec Docker (Recommandé)

1. **Cloner le projet**
```bash
git clone https://github.com/abdoul9859/techzone.git
cd techzone
```

2. **Démarrer l'application**
```bash
docker compose up -d --build
```

L'application sera accessible sur : `http://localhost` (ou votre domaine configuré)

### Installation locale

1. **Créer un environnement virtuel**
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows
```

2. **Installer les dépendances**
```bash
pip install -r requirements.txt
```

3. **Démarrer l'application**
```bash
python start.py
```

L'application sera accessible sur : http://127.0.0.1:8000

## 👤 Comptes par défaut

- **Administrateur** : `admin` / `admin123`
- **Utilisateur** : `user` / `user123`

## 🗄️ Base de données

La base de données SQLite est créée automatiquement au premier démarrage dans le dossier `data/`.

### Structure

- `users` : Utilisateurs et authentification
- `clients` : Informations clients
- `products` : Produits principaux
- `product_variants` : Variantes avec IMEI/codes-barres
- `product_variant_attributes` : Attributs des variantes
- `stock_movements` : Mouvements de stock
- `quotations` / `quotation_items` : Devis
- `invoices` / `invoice_items` : Factures
- `invoice_payments` : Paiements
- `delivery_notes` / `delivery_note_items` : Bons de livraison

## 🚀 Déploiement

### Docker Compose

L'application utilise Docker Compose avec :
- **app** : Conteneur FastAPI
- **caddy** : Reverse proxy avec certificat SSL automatique (Let's Encrypt)

Configuration dans `docker-compose.yml` :
- Ports : 80 (HTTP) et 443 (HTTPS)
- Volumes : données, uploads, logs, templates
- Variables d'environnement : configuration de l'application

### Variables d'environnement

Les principales variables (définies dans `docker-compose.yml`) :
- `DATABASE_URL` : URL de connexion à la base de données
- `APP_PUBLIC_URL` : URL publique de l'application
- `INIT_DB_ON_STARTUP` : Initialiser la base au démarrage
- `SEED_DEFAULT_DATA` : Créer les données par défaut

## 🔒 Sécurité

- **Authentification JWT** : Tokens sécurisés
- **Validation des données** : Pydantic schemas
- **Contrôle d'accès** : Rôles et permissions
- **HTTPS** : Certificat SSL automatique via Caddy
- **Validation côté serveur** : Toutes les entrées validées

## 📱 Responsive Design

L'interface s'adapte automatiquement :
- **Desktop** : Interface complète
- **Tablet** : Navigation optimisée
- **Mobile** : Menu hamburger, cartes empilées

## 📝 Notes

- Les fichiers sensibles (credentials, base de données, logs) sont exclus du dépôt via `.gitignore`
- Les uploads sont stockés dans `static/uploads/` (non versionnés)
- La configuration Docker est prête pour la production avec HTTPS automatique

## 📄 Licence

Application développée pour TECHZONE - Tous droits réservés.
