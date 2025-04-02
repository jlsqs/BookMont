require('dotenv').config();
const puppeteer = require('puppeteer');

let consoleLogs = [];
let browser = null;

function log(message) {
    const timestamp = new Date().toISOString();
    consoleLogs.push(`[${timestamp}] ${message}`);
    console.log(`[${timestamp}] ${message}`);
}

async function main() {
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080'
            ]
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Login
        log('Tentative de connexion...');
        await page.goto('https://lamontgolfiereclub.com/dashboard/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await page.type('#connexion_email', process.env.MONTGOLFIERE_EMAIL);
        await page.type('#connexion_password', process.env.MONTGOLFIERE_PASSWORD);
        await page.click('#btn-connexion');
        
        await page.waitForSelector('#account__logout', { timeout: 30000 });
        log('Connexion réussie!');

        // Navigation vers le planning
        log('Navigation vers le planning...');
        await page.goto('https://lamontgolfiereclub.com/planning/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Attente du chargement des cours
        await page.waitForSelector('.planning__box', { timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Calcul de la date cible (5 jours plus tard)
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 5);
        const targetWeekday = targetDate.getDay();
        const targetDateString = targetDate.toLocaleDateString('fr-FR', { 
            day: '2-digit',
            month: 'long'
        });

        log(`Recherche d'un cours pour le ${targetDateString}`);

        // Définition de l'heure du cours selon le jour
        const classTimes = {
            1: "07h30", // Lundi
            2: "08h40", // Mardi
            3: "07h30", // Mercredi
            4: "08h35", // Jeudi
            5: "08h35", // Vendredi
        };
        const targetClassTime = classTimes[targetWeekday] || "08h35";

        // Recherche du cours
        const uniqueClassId = await page.evaluate((targetDateString, targetClassTime) => {
            const classElements = document.querySelectorAll('.planning__box');
            for (let el of classElements) {
                const dateElement = el.querySelector('.planning__event-date');
                const timeElement = el.querySelector('.planning__event-time');
                const nameElement = el.querySelector('.planning__event-name');

                if (dateElement && timeElement && nameElement &&
                    dateElement.textContent.trim().endsWith(targetDateString) &&
                    timeElement.textContent.trim().startsWith(targetClassTime) &&
                    ["hard training", "bootcamp", "cross training"].includes(
                        nameElement.textContent.trim().toLowerCase()
                    )) {
                    const onclickValue = el.getAttribute('onclick');
                    const match = onclickValue.match(/show_detail\((\d+),/);
                    return match ? match[1] : null;
                }
            }
            return null;
        }, targetDateString, targetClassTime);

        if (!uniqueClassId) {
            throw new Error('Cours non trouvé pour la date et l\'heure spécifiées');
        }

        log(`Cours trouvé! ID: ${uniqueClassId}`);

        // Clic sur le cours
        await page.evaluate((uniqueClassId) => {
            const element = document.querySelector(
                `.planning__box[onclick*="show_detail(${uniqueClassId},"]`
            );
            if (element) element.click();
        }, uniqueClassId);

        // Attente et clic sur le bouton de réservation
        await page.waitForSelector(
            `button[onclick="go_subscribe(${uniqueClassId});"]`,
            { timeout: 5000 }
        );
        await page.click(`button[onclick="go_subscribe(${uniqueClassId});"]`);
        
        log('Réservation effectuée avec succès!');
        
        // Attente pour s'assurer que la réservation est bien enregistrée
        await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
        log(`Erreur: ${error.message}`);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            log('Navigateur fermé');
        }
    }
}

// Exécution du script
main().catch(error => {
    log(`Erreur fatale: ${error.message}`);
    process.exit(1);
});
