require('dotenv').config();
const puppeteer = require('puppeteer');

let consoleLogs = [];
let browser = null;

function log(message) {
    const timestamp = new Date().toISOString();
    consoleLogs.push(`[${timestamp}] ${message}`);
    console.log(`[${timestamp}] ${message}`);
}

async function waitForBookingButton(page, uniqueClassId, classTime) {
    console.log(`Waiting for booking button for class ${uniqueClassId}...`);
    
    // Attendre que le bouton soit visible
    await page.waitForSelector(
        `button[onclick="go_subscribe(${uniqueClassId});"]`,
        { timeout: 10000 }
    );
    
    // Calculer l'heure exacte d'ouverture (5 jours avant l'heure du cours)
    const [hours, minutes] = classTime.split('h').map(Number);
    const targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);
    
    // Vérifier si on est déjà en retard
    const now = new Date();
    const timeToWait = targetTime - now;
    
    if (timeToWait < -300000) { // Si on est plus de 5 minutes en retard
        console.log('❌ Too late to book: more than 5 minutes after opening time');
        return false;
    }
    
    if (timeToWait > 0) {
        console.log(`Waiting ${Math.floor(timeToWait / 1000)} seconds until booking time...`);
        await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    
    // Attendre 4 secondes après l'heure d'ouverture pour s'assurer que le créneau est bien ouvert
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Tenter de cliquer sur le bouton avec retry en cas d'échec
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await page.click(`button[onclick="go_subscribe(${uniqueClassId});"]`);
            
            // Attendre un court instant pour voir si une erreur apparaît
            await page.waitForTimeout(1000);
            
            // Vérifier si une erreur est apparue
            const errorMessage = await page.evaluate(() => {
                const errorElement = document.querySelector('.alert-danger');
                return errorElement ? errorElement.textContent : null;
            });
            
            if (errorMessage) {
                console.log(`❌ Attempt ${attempt}/3: ${errorMessage}`);
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                return false;
            }
            
            console.log('✅ Booking successful!');
            return true;
            
        } catch (error) {
            console.log(`❌ Attempt ${attempt}/3: Error clicking button: ${error.message}`);
            if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            return false;
        }
    }
    
    return false;
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
        const buttonFound = await waitForBookingButton(page, uniqueClassId, targetClassTime);
        if (!buttonFound) {
            console.log('Could not book the class, exiting...');
            await browser.close();
            return;
        }
        
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
