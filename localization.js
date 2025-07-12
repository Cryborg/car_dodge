// Système de localisation
class Localization {
    constructor() {
        this.currentLang = this.getDefaultLanguage(); // Langue détectée automatiquement
        this.translations = this.getEmbeddedTranslations(); // Fallback intégré
        this.loadedLanguages = new Set(['fr', 'en']); // Langues intégrées disponibles
    }

    // Traductions intégrées comme fallback
    getEmbeddedTranslations() {
        return {
            'fr': {
                'game': {
                    'title': 'Course de Voitures',
                    'startGame': 'Commencer la partie',
                    'level': 'Niveau',
                    'score': 'Score',
                    'lives': 'Vies',
                    'pause': 'PAUSE',
                    'gameOver': '🏁 Partie Terminée !',
                    'finalScore': 'Score Final',
                    'enterName': 'Entrez votre nom',
                    'saveScore': 'Sauvegarder',
                    'backToMenu': 'Rejouer',
                    'bestScores': 'Meilleurs Scores',
                    'noScores': 'Aucun score',
                    'resetScores': '🗑️ Réinitialiser les scores',
                    'levelUp': 'NIVEAU {level} !',
                    'bonusPoints': '+{points} points',
                    'bonusPoint': '+{points} point',
                    'bonusLives': '+{lives} vies',
                    'bonusLife': '+{lives} vie',
                    'preparingGame': 'Préparez-vous...',
                    'resumeGame': 'Appuyez sur P pour reprendre',
                    'chooseLevel': 'Choisis ton niveau de départ :',
                    'loading': 'Chargement...',
                    'progress': 'Progression'
                },
                'difficulty': {
                    'easy': '1 (Facile)',
                    'normal': '6 (Normal)',
                    'hard': '12 (Difficile)',
                    'expert': '18 (Expert)',
                    'hell': '25 (Enfer)'
                },
                'controls': {
                    'arrows': 'Flèches pour se déplacer',
                    'pause': 'P pour mettre en pause',
                    'restart': 'R pour rejouer',
                    'debug': 'D pour le mode debug',
                    'enter': 'Entrée pour commencer',
                    'escape': 'Échap (x2) pour quitter'
                }
            },
            'en': {
                'game': {
                    'title': 'Car Race',
                    'startGame': 'Start Game',
                    'level': 'Level',
                    'score': 'Score',
                    'lives': 'Lives',
                    'pause': 'PAUSE',
                    'gameOver': '🏁 Game Over!',
                    'finalScore': 'Final Score',
                    'enterName': 'Enter your name',
                    'saveScore': 'Save Score',
                    'backToMenu': 'Play Again',
                    'bestScores': 'Best Scores',
                    'noScores': 'No scores',
                    'resetScores': '🗑️ Reset Scores',
                    'levelUp': 'LEVEL {level} !',
                    'bonusPoints': '+{points} points',
                    'bonusPoint': '+{points} point',
                    'bonusLives': '+{lives} lives',
                    'bonusLife': '+{lives} life',
                    'preparingGame': 'Get ready...',
                    'resumeGame': 'Press P to resume',
                    'chooseLevel': 'Choose your starting level:',
                    'loading': 'Loading...',
                    'progress': 'Progress'
                },
                'difficulty': {
                    'easy': '1 (Easy)',
                    'normal': '6 (Normal)',
                    'hard': '12 (Hard)',
                    'expert': '18 (Expert)',
                    'hell': '25 (Hell)'
                },
                'controls': {
                    'arrows': 'Arrow keys to move',
                    'pause': 'P to pause',
                    'restart': 'R to restart',
                    'debug': 'D for debug mode',
                    'enter': 'Enter to start',
                    'escape': 'Escape (x2) to quit'
                }
            }
        };
    }

    // Détecter la langue par défaut du navigateur
    getDefaultLanguage() {
        // Langues supportées par le jeu
        const supportedLanguages = ['fr', 'en'];
        
        // Obtenir la langue du navigateur
        const browserLang = navigator.language || navigator.userLanguage;
        
        // Extraire le code langue (ex: 'en-US' -> 'en')
        const langCode = browserLang.split('-')[0].toLowerCase();
        
        // Retourner la langue si supportée, sinon anglais par défaut
        return supportedLanguages.includes(langCode) ? langCode : 'en';
    }

    // Charger une langue
    async loadLanguage(lang) {
        if (this.loadedLanguages.has(lang)) {
            console.log(`Language ${lang} already loaded`);
            return;
        }

        console.log(`Loading language: ${lang}`);
        try {
            const url = `locales/${lang}.json`;
            console.log(`Fetching: ${url}`);
            const response = await fetch(url);
            console.log(`Response status: ${response.status}`);
            
            if (!response.ok) {
                console.error(`HTTP ${response.status}: Failed to load language: ${lang}`);
                return Promise.reject(new Error(`Failed to load ${lang}`));
            }
            
            const translations = await response.json();
            console.log(`Loaded translations for ${lang}:`, translations);
            
            this.translations[lang] = translations;
            this.loadedLanguages.add(lang);
            console.log(`Successfully loaded ${lang}`);
        } catch (error) {
            console.error(`Error loading language ${lang}:`, error);
            // Fallback vers l'anglais si une autre langue échoue
            if (lang !== 'en') {
                console.log(`Falling back to English`);
                return this.loadLanguage('en');
            }
            // Si même l'anglais échoue, utiliser les traductions intégrées
            return Promise.resolve();
        }
    }

    // Changer la langue actuelle
    async setLanguage(lang) {
        await this.loadLanguage(lang);
        this.currentLang = lang;
        localStorage.setItem('gameLanguage', lang);
        this.updateUI();
    }

    // Obtenir une traduction
    t(key, params = {}) {
        const keys = key.split('.');
        let translation = this.translations[this.currentLang];
        
        // Naviguer dans l'objet de traduction
        for (const k of keys) {
            if (translation && typeof translation === 'object') {
                translation = translation[k];
            } else {
                translation = undefined;
                break;
            }
        }

        // Fallback vers l'anglais si la traduction n'existe pas
        if (translation === undefined && this.currentLang !== 'en') {
            let fallback = this.translations['en'];
            for (const k of keys) {
                if (fallback && typeof fallback === 'object') {
                    fallback = fallback[k];
                } else {
                    fallback = undefined;
                    break;
                }
            }
            translation = fallback;
        }

        // Si toujours pas trouvé, retourner la clé
        if (translation === undefined) {
            console.warn(`Translation not found for key: ${key}`);
            return key;
        }

        // Remplacer les paramètres
        if (typeof translation === 'string' && Object.keys(params).length > 0) {
            return translation.replace(/\{(\w+)}/g, (match, param) => {
                return params[param] !== undefined ? params[param] : match;
            });
        }

        return translation;
    }

    // Mettre à jour l'interface utilisateur
    updateUI() {
        // Mettre à jour tous les éléments avec data-i18n
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const params = element.getAttribute('data-i18n-params');
            const parsedParams = params ? JSON.parse(params) : {};
            const translation = this.t(key, parsedParams);
            
            if (element.tagName === 'TITLE') {
                // Traitement spécial pour le titre de la page
                document.title = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Mettre à jour les placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });

        // Mettre à jour les titres (title attributes)
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });
    }

    // Initialiser le système de localisation
    async initialize() {
        try {
            // Déterminer la langue à utiliser : sauvegardée > navigateur > anglais
            const savedLang = localStorage.getItem('gameLanguage');
            const targetLang = savedLang || this.getDefaultLanguage();
            
            console.log('Initializing localization with target language:', targetLang);
            
            // Les traductions sont déjà chargées en mémoire
            this.currentLang = targetLang;
            localStorage.setItem('gameLanguage', targetLang);
            
            // Mettre à jour l'interface
            this.updateUI();
            
            // Mettre à jour le sélecteur de langue
            const languageSelect = document.getElementById('languageSelect');
            if (languageSelect) {
                languageSelect.value = this.currentLang;
            }
            
            console.log('Localization initialized successfully with embedded translations');
        } catch (error) {
            console.error('Failed to initialize localization:', error);
        }
    }

    // Obtenir les langues disponibles
    getAvailableLanguages() {
        return [
            { code: 'fr', name: 'Français', flag: '🇫🇷' },
            { code: 'en', name: 'English', flag: '🇺🇸' }
        ];
    }
}

// Instance globale
const i18n = new Localization();

// Fonction raccourci pour les traductions
function t(key, params = {}) {
    return i18n.t(key, params);
}

// L'initialisation sera faite depuis game.js
// Auto-initialiser quand le DOM est prêt (désactivé)
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', () => i18n.initialize());
// } else {
//     i18n.initialize();
// }