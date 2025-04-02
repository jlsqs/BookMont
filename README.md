# Montgolfiere Class Booking Automation

Ce projet automatise la réservation de cours de montgolfière en utilisant Puppeteer pour simuler les interactions utilisateur sur le site web.

## Configuration

1. Créez un fichier `.env` à la racine du projet avec les informations suivantes :
```env
MONTGOLFIERE_EMAIL=votre_email@example.com
MONTGOLFIERE_PASSWORD=votre_mot_de_passe
```

2. Configurez les secrets GitHub :
   - Allez dans les paramètres de votre dépôt GitHub
   - Naviguez vers "Secrets and variables" > "Actions"
   - Ajoutez deux secrets :
     - `MONTGOLFIERE_EMAIL`
     - `MONTGOLFIERE_PASSWORD`

## Installation

```bash
npm install
```

## Utilisation

### Exécution locale

```bash
npm start
```

### Exécution automatique via GitHub Actions

Le script s'exécute automatiquement selon le planning suivant (heure française) :
- Mercredi à 7h25
- Jeudi à 8h35
- Vendredi à 7h25
- Samedi à 8h30
- Dimanche à 8h30

Note : Les heures sont en heure française (UTC+1 en hiver, UTC+2 en été). Le script s'adapte automatiquement au changement d'heure.

Pour exécuter manuellement le script via GitHub Actions :
1. Allez dans l'onglet "Actions" de votre dépôt GitHub
2. Sélectionnez le workflow "Book Montgolfiere Class"
3. Cliquez sur "Run workflow"

## Structure du projet

- `bookclass.js` : Script principal d'automatisation
- `.github/workflows/booking.yml` : Configuration GitHub Actions
- `.env` : Fichier de configuration (à créer localement)
- `.gitignore` : Fichier de configuration Git

## Sécurité

- Les informations sensibles sont stockées dans des variables d'environnement
- Le fichier `.env` est ignoré par Git
- Les secrets sont gérés de manière sécurisée via GitHub Secrets

## Dépendances

- Node.js 20+
- Puppeteer
- dotenv

## Personnalisation

Le workflow est configuré pour s'exécuter à 7h25 les jours de semaine. Pour modifier l'horaire :

1. Modifier le fichier `.github/workflows/booking.yml`
2. Ajuster la ligne `cron: '25 7 * * 1-5'`
   - Format : `minute heure * * jour`
   - Jours : 1-5 (lundi à vendredi)

## Développement Local

```bash
# Installer les dépendances
npm install

# Créer le fichier .env
cp .env.example .env
# Éditer .env avec vos identifiants

# Lancer le script
npm start
```

## Contribution

Les pull requests sont bienvenues. Pour les changements majeurs, ouvrez d'abord une issue pour en discuter. 