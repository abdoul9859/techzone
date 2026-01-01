/**
 * WhatsApp Utility Functions for n8n Workflows
 * TECHZONE - Gestion de Stock
 * 
 * Ce fichier contient les fonctions utilitaires pour envoyer des messages WhatsApp
 * via le service WhatsApp configuré dans l'infrastructure TECHZONE.
 */

// Configuration du service WhatsApp
const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://whatsapp-service:3001';
const APP_NAME = process.env.APP_NAME || 'TECHZONE';
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || 'https://techzonesn.cc';

/**
 * Envoie un message texte via WhatsApp
 * @param {string} phone - Numéro de téléphone (format international)
 * @param {string} text - Message texte à envoyer
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendText(phone, text) {
  try {
    const response = await fetch(`${WHATSAPP_SERVICE_URL}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: phone,
        text: text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`Message WhatsApp envoyé à ${phone}:`, result);
    return {
      success: true,
      message: 'Message envoyé avec succès',
      data: result
    };
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message WhatsApp:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
}

/**
 * Envoie un fichier PDF via WhatsApp
 * @param {string} phone - Numéro de téléphone (format international)
 * @param {string} htmlUrl - URL HTML de la page à convertir en PDF
 * @param {string} filename - Nom du fichier PDF
 * @param {string} caption - Légende du message (optionnel)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
async function sendPdf(phone, htmlUrl, filename, caption = '') {
  try {
    const response = await fetch(`${WHATSAPP_SERVICE_URL}/api/sendPdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: phone,
        htmlUrl: htmlUrl,
        filename: filename,
        caption: caption
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`PDF WhatsApp envoyé à ${phone}:`, result);
    return {
      success: true,
      message: 'PDF envoyé avec succès',
      data: result
    };
  } catch (error) {
    console.error('Erreur lors de l\'envoi du PDF WhatsApp:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
}

/**
 * Formate un montant en F CFA
 * @param {number} amount - Montant à formater
 * @returns {string} Montant formaté
 */
function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0
  });
}

/**
 * Construit l'URL d'une page d'impression depuis le réseau Docker
 * @param {string} path - Chemin de la page (ex: /invoices/print/123)
 * @returns {string} URL complète
 */
function buildPrintUrl(path) {
  // Dans n8n, on utilise le nom du service Docker pour accéder à l'app
  const dockerServiceUrl = process.env.APP_DOCKER_URL || 'http://techzone_app:8000';
  return `${dockerServiceUrl}${path}`;
}

/**
 * Construit un message de facture formaté
 * @param {Object} data - Données de la facture
 * @returns {string} Message formaté
 */
function buildInvoiceMessage(data) {
  const { invoice_number, client_name, total } = data;
  const totalFormatted = formatCurrency(total);
  
  return `Bonjour ${client_name || 'Client'},

📄 *FACTURE N° ${invoice_number}*
💰 Montant total: ${totalFormatted} F CFA

Merci pour votre confiance.
Pour toute question, n'hésitez pas à nous contacter.

Cordialement,
${APP_NAME}`;
}

/**
 * Construit un message de devis formaté
 * @param {Object} data - Données du devis
 * @returns {string} Message formaté
 */
function buildQuotationMessage(data) {
  const { quotation_number, client_name, total } = data;
  const totalFormatted = formatCurrency(total);
  
  return `Bonjour ${client_name || 'Client'},

📋 *DEVIS N° ${quotation_number}*
💰 Montant total: ${totalFormatted} F CFA

Merci pour votre confiance.
Pour toute question, n'hésitez pas à nous contacter.

Cordialement,
${APP_NAME}`;
}

/**
 * Normalise un numéro de téléphone
 * @param {string} phone - Numéro de téléphone à normaliser
 * @returns {string} Numéro normalisé
 */
function normalizePhone(phone) {
  if (!phone) return '';
  
  // Supprimer les espaces et caractères spéciaux
  let normalized = phone.replace(/[\s\-\(\)]/g, '');
  
  // Ajouter l'indicatif si absent (Sénégal: +221)
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('00')) {
      normalized = '+' + normalized.substring(2);
    } else if (normalized.startsWith('221')) {
      normalized = '+' + normalized;
    } else if (normalized.startsWith('0')) {
      normalized = '+221' + normalized.substring(1);
    } else {
      normalized = '+221' + normalized;
    }
  }
  
  return normalized;
}

// Export des fonctions pour utilisation dans n8n
module.exports = {
  sendText,
  sendPdf,
  formatCurrency,
  buildPrintUrl,
  buildInvoiceMessage,
  buildQuotationMessage,
  normalizePhone,
  WHATSAPP_SERVICE_URL,
  APP_NAME,
  APP_PUBLIC_URL
};

