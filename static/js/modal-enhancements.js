/**
 * Améliorations des modals de formulaires
 * - Empêche la fermeture en cliquant sur le backdrop
 * - Ajoute des boutons de navigation (début/fin du formulaire)
 * - Ajoute un bouton de fermeture explicite
 */

(function() {
    'use strict';

    // Configuration des modals au chargement de la page
    document.addEventListener('DOMContentLoaded', function() {
        enhanceFormModals();
    });

    /**
     * Améliore tous les modals contenant un formulaire
     */
    function enhanceFormModals() {
        // Sélectionner tous les modals
        const allModals = document.querySelectorAll('.modal');
        
        allModals.forEach(function(modalEl) {
            // Vérifier si le modal contient un formulaire
            const form = modalEl.querySelector('form');
            const hasFormModal = modalEl.hasAttribute('data-form-modal') && modalEl.getAttribute('data-form-modal') === 'true';
            
            // Ne traiter que les modals avec formulaire ou marqués explicitement
            if ((form || hasFormModal) && !modalEl.hasAttribute('data-enhanced')) {
                modalEl.setAttribute('data-enhanced', 'true');
                
                // Ajouter les boutons de navigation si le modal contient un formulaire
                if (form) {
                    addNavigationButtons(modalEl, form);
                }
                
                // Configurer le modal lors de son affichage
                modalEl.addEventListener('show.bs.modal', function() {
                    configureModal(modalEl);
                }, { once: false });
            }
        });
    }

    /**
     * Configure un modal pour empêcher la fermeture sur backdrop
     */
    function configureModal(modalEl) {
        // Obtenir l'instance Bootstrap Modal existante
        let modalInstance = bootstrap.Modal.getInstance(modalEl);
        
        if (modalInstance) {
            // Mettre à jour la configuration de l'instance existante
            modalInstance._config.backdrop = 'static';
            modalInstance._config.keyboard = false;
            // Forcer la mise à jour du backdrop
            if (modalInstance._backdrop) {
                modalInstance._backdrop._config.clickable = false;
            }
        }
    }

    /**
     * Ajoute les boutons de navigation et de fermeture au modal
     */
    function addNavigationButtons(modalEl, form) {
        // Vérifier si les boutons existent déjà
        if (modalEl.querySelector('.modal-nav-buttons')) {
            return;
        }

        // Trouver ou créer le modal-footer
        let footer = modalEl.querySelector('.modal-footer');
        if (!footer) {
            // Créer le footer s'il n'existe pas
            const modalContent = modalEl.querySelector('.modal-content');
            if (modalContent) {
                footer = document.createElement('div');
                footer.className = 'modal-footer';
                modalContent.appendChild(footer);
            } else {
                return; // Pas de modal-content, on ne peut pas ajouter de footer
            }
        }

        // Créer le conteneur pour les boutons de navigation
        const navButtonsContainer = document.createElement('div');
        navButtonsContainer.className = 'modal-nav-buttons me-auto';
        
        // Bouton pour aller au début du formulaire
        const btnTop = document.createElement('button');
        btnTop.type = 'button';
        btnTop.className = 'btn btn-outline-secondary btn-sm';
        btnTop.innerHTML = '<i class="bi bi-arrow-up-circle me-1"></i>Début';
        btnTop.title = 'Aller au début du formulaire';
        btnTop.onclick = function() {
            scrollToFormTop(form);
        };
        
        // Bouton pour aller à la fin du formulaire
        const btnBottom = document.createElement('button');
        btnBottom.type = 'button';
        btnBottom.className = 'btn btn-outline-secondary btn-sm';
        btnBottom.innerHTML = '<i class="bi bi-arrow-down-circle me-1"></i>Fin';
        btnBottom.title = 'Aller à la fin du formulaire';
        btnBottom.onclick = function() {
            scrollToFormBottom(form);
        };
        
        navButtonsContainer.appendChild(btnTop);
        navButtonsContainer.appendChild(btnBottom);
        
        // Insérer les boutons de navigation au début du footer
        footer.insertBefore(navButtonsContainer, footer.firstChild);
        
        // Ajouter un bouton de fermeture si il n'existe pas déjà
        const existingCloseBtn = footer.querySelector('[data-bs-dismiss="modal"]');
        if (!existingCloseBtn) {
            const btnClose = document.createElement('button');
            btnClose.type = 'button';
            btnClose.className = 'btn btn-secondary';
            btnClose.setAttribute('data-bs-dismiss', 'modal');
            btnClose.innerHTML = '<i class="bi bi-x-circle me-1"></i>Fermer';
            footer.appendChild(btnClose);
        }
    }

    /**
     * Fait défiler vers le début du formulaire
     */
    function scrollToFormTop(form) {
        const modalBody = form.closest('.modal-body') || form.closest('.modal-content');
        if (modalBody) {
            modalBody.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            // Focus sur le premier champ du formulaire
            const firstInput = form.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 300);
            }
        }
    }

    /**
     * Fait défiler vers la fin du formulaire
     */
    function scrollToFormBottom(form) {
        const modalBody = form.closest('.modal-body') || form.closest('.modal-content');
        if (modalBody) {
            modalBody.scrollTo({
                top: modalBody.scrollHeight,
                behavior: 'smooth'
            });
            // Focus sur le dernier champ du formulaire
            const inputs = form.querySelectorAll('input:not([type="hidden"]), select, textarea');
            if (inputs.length > 0) {
                const lastInput = inputs[inputs.length - 1];
                setTimeout(() => lastInput.focus(), 300);
            }
        }
    }

    /**
     * Fonction helper pour créer/ouvrir un modal avec les améliorations
     */
    window.openEnhancedModal = function(modalId, options = {}) {
        const modalEl = document.getElementById(modalId);
        if (!modalEl) {
            console.error('Modal not found:', modalId);
            return null;
        }

        // S'assurer que le modal est amélioré
        if (!modalEl.hasAttribute('data-enhanced')) {
            const form = modalEl.querySelector('form');
            if (form) {
                addNavigationButtons(modalEl, form);
            }
            modalEl.setAttribute('data-enhanced', 'true');
        }

        // Créer ou obtenir l'instance du modal avec la configuration améliorée
        let modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (!modalInstance) {
            modalInstance = new bootstrap.Modal(modalEl, {
                backdrop: 'static',
                keyboard: false,
                ...options
            });
        } else {
            // Mettre à jour la configuration
            modalInstance._config.backdrop = 'static';
            modalInstance._config.keyboard = false;
        }
        
        modalInstance.show();
        
        return modalInstance;
    };

    // Intercepter les créations de modals pour les modals avec formulaires
    const originalModal = window.bootstrap?.Modal || (window.bootstrap && window.bootstrap.Modal);
    if (originalModal) {
        // Wrapper pour intercepter les nouvelles instances
        const OriginalModal = originalModal;
        window.bootstrap.Modal = function(element, config) {
            const modalEl = typeof element === 'string' ? document.getElementById(element) : element;
            
            // Vérifier si c'est un modal avec formulaire
            const form = modalEl?.querySelector('form');
            const hasFormModal = modalEl?.hasAttribute('data-form-modal') && modalEl.getAttribute('data-form-modal') === 'true';
            
            // Si c'est un modal avec formulaire, forcer backdrop static et keyboard false
            if ((form || hasFormModal) && modalEl) {
                config = config || {};
                config.backdrop = 'static';
                config.keyboard = false;
                
                // S'assurer que les boutons de navigation sont ajoutés
                if (form && !modalEl.hasAttribute('data-enhanced')) {
                    addNavigationButtons(modalEl, form);
                    modalEl.setAttribute('data-enhanced', 'true');
                }
            }
            
            return new OriginalModal(modalEl, config);
        };
        
        // Copier les méthodes statiques
        Object.setPrototypeOf(window.bootstrap.Modal, OriginalModal);
        Object.getOwnPropertyNames(OriginalModal).forEach(function(name) {
            if (name !== 'prototype' && name !== 'length' && name !== 'name') {
                try {
                    window.bootstrap.Modal[name] = OriginalModal[name];
                } catch (e) {
                    // Ignorer les propriétés non copiables
                }
            }
        });
    }

    // Réappliquer les améliorations après le chargement dynamique de contenu
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // Element node
                    if (node.classList && node.classList.contains('modal')) {
                        enhanceFormModals();
                    } else if (node.querySelectorAll) {
                        const modals = node.querySelectorAll('.modal');
                        if (modals.length > 0) {
                            enhanceFormModals();
                        }
                    }
                }
            });
        });
    });

    // Observer les changements dans le body
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
