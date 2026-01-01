# n8n Workflows - TECHZONE

Ce dossier contient les fichiers de configuration et utilitaires pour les workflows n8n de TECHZONE.

## Structure

- `whatsapp.js` - Module JavaScript contenant les fonctions utilitaires pour l'envoi de messages WhatsApp
- `README.md` - Ce fichier

## Installation dans n8n

Pour utiliser le module `whatsapp.js` dans vos workflows n8n :

1. **Copier le fichier dans n8n** :
   ```bash
   # Si n8n est dans un conteneur Docker
   docker cp /opt/TECHZONE/n8n/whatsapp.js <n8n_container>:/data/n8n/whatsapp.js
   
   # Ou si n8n est installé localement
   cp /opt/TECHZONE/n8n/whatsapp.js /path/to/n8n/data/whatsapp.js
   ```

2. **Dans vos workflows n8n**, utilisez le module ainsi :
   ```javascript
   const whatsapp = require('/data/n8n/whatsapp.js');
   ```

## Fonctions disponibles

### `sendText(phone, text)`
Envoie un message texte via WhatsApp.
- `phone` : Numéro de téléphone (format international, sera normalisé automatiquement)
- `text` : Message texte à envoyer
- Retourne : `Promise<Object>` avec `{success, message, data}`

### `sendPdf(phone, htmlUrl, filename, caption)`
Envoie un fichier PDF via WhatsApp.
- `phone` : Numéro de téléphone (format international)
- `htmlUrl` : URL HTML de la page à convertir en PDF
- `filename` : Nom du fichier PDF
- `caption` : Légende du message (optionnel)
- Retourne : `Promise<Object>` avec `{success, message, data}`

### `formatCurrency(amount)`
Formate un montant en F CFA.
- `amount` : Montant numérique
- Retourne : `string` (ex: "150 000 F CFA")

### `buildPrintUrl(path)`
Construit l'URL complète d'une page d'impression depuis le réseau Docker.
- `path` : Chemin de la page (ex: `/invoices/print/123`)
- Retourne : `string` (ex: `http://techzone_app:8000/invoices/print/123`)

### `buildInvoiceMessage(data)`
Construit un message formaté pour une facture.
- `data` : Objet avec `{invoice_number, client_name, total}`
- Retourne : `string` (message formaté)

### `buildQuotationMessage(data)`
Construit un message formaté pour un devis.
- `data` : Objet avec `{quotation_number, client_name, total}`
- Retourne : `string` (message formaté)

### `normalizePhone(phone)`
Normalise un numéro de téléphone au format international.
- `phone` : Numéro de téléphone (peut être dans différents formats)
- Retourne : `string` (format international, ex: `+221771234567`)

## Configuration

Le module utilise les variables d'environnement suivantes :

- `WHATSAPP_SERVICE_URL` : URL du service WhatsApp (défaut: `http://whatsapp-service:3001`)
- `APP_NAME` : Nom de l'application (défaut: `TECHZONE`)
- `APP_PUBLIC_URL` : URL publique de l'application (défaut: `https://techzonesn.cc`)
- `APP_DOCKER_URL` : URL interne Docker de l'application (défaut: `http://techzone_app:8000`)

## Workflows disponibles

Les workflows suivants sont configurés dans TECHZONE :

1. **send-debt-reminder-whatsapp** - Envoie des rappels de dette par WhatsApp
2. **send-invoice-whatsapp** - Envoie des factures par WhatsApp
3. **send-invoice-email** - Envoie des factures par email
4. **send-quotation-whatsapp** - Envoie des devis par WhatsApp
5. **send-quotation-email** - Envoie des devis par email
6. **send-maintenance-reminder-whatsapp** - Envoie des rappels de maintenance par WhatsApp
7. **send-warranty-reminder-whatsapp** - Envoie des rappels de garantie par WhatsApp

## Exemple d'utilisation dans un workflow n8n

```javascript
// Dans un nœud Code n8n
const whatsapp = require('/data/n8n/whatsapp.js');

const data = $input.first().json.body || $input.first().json;

// Normaliser le numéro de téléphone
const phone = whatsapp.normalizePhone(data.phone);

// Construire l'URL de la facture
const htmlUrl = whatsapp.buildPrintUrl(`/invoices/print/${data.invoice_id}`);

// Construire le message
const caption = whatsapp.buildInvoiceMessage({
  invoice_number: data.invoice_number,
  client_name: data.client_name,
  total: data.total
});

// Envoyer le PDF
const result = await whatsapp.sendPdf(phone, htmlUrl, `Facture-${data.invoice_number}.pdf`, caption);

return [{
  json: {
    success: result.success,
    message: result.message
  }
}];
```

## Notes importantes

- Le module `whatsapp.js` doit être accessible depuis n8n via le système de fichiers
- Les workflows utilisent le réseau Docker pour communiquer avec l'application TECHZONE
- Les numéros de téléphone sont automatiquement normalisés au format international
- Le service WhatsApp doit être configuré et accessible depuis n8n

