require('dotenv').config();
const puppeteer = require('puppeteer');

let consoleLogs = []; // Array to store console logs
let browser = null;

function log(message) {
    const timestamp = new Date().toISOString();
    consoleLogs.push(`[${timestamp}] ${message}`);
    console.log(`[${timestamp}] ${message}`);
}

// Vérifier les variables d'environnement
if (!process.env.MONTGOLFIERE_EMAIL || !process.env.MONTGOLFIERE_PASSWORD) {
    log('❌ Erreur: Les variables d\'environnement MONTGOLFIERE_EMAIL et MONTGOLFIERE_PASSWORD doivent être définies');
    process.exit(1);
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
        let loginSuccess = false;
        let retryCount = 0;
        const maxRetries = 3;

        while (!loginSuccess && retryCount < maxRetries) {
            try {
                await page.goto('https://lamontgolfiereclub.com/dashboard/', {
                    waitUntil: ['networkidle0', 'domcontentloaded'],
                    timeout: 30000 // Back to 30 seconds
                });

                // Vérifier que les champs de connexion existent
                await page.waitForSelector('#connexion_email', { timeout: 30000 });
                await page.waitForSelector('#connexion_password', { timeout: 30000 });

                // Saisir les identifiants
                await page.type('#connexion_email', process.env.MONTGOLFIERE_EMAIL);
                await page.type('#connexion_password', process.env.MONTGOLFIERE_PASSWORD);
                await page.click('#btn-connexion');
                
                await page.waitForSelector('#account__logout', { timeout: 30000 });
                log('Connexion réussie!');
                loginSuccess = true;
            } catch (error) {
                retryCount++;
                log(`Tentative ${retryCount}/${maxRetries} échouée: ${error.message}`);
                if (retryCount < maxRetries) {
                    log('Nouvelle tentative dans 10 secondes...');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                } else {
                    throw new Error(`Échec de la connexion après ${maxRetries} tentatives`);
                }
            }
        }

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

async function waitForBookingButton(page, uniqueClassId, targetClassTime) {
    console.log(`Waiting for booking button for class ${uniqueClassId}...`);
    
    // Attendre que le bouton soit visible
    await page.waitForSelector(
        `button[onclick="go_subscribe(${uniqueClassId});"]`,
        { timeout: 10000 }
    );
    
    // Calculer l'heure exacte d'ouverture en tenant compte du décalage horaire
    const [hours, minutes] = targetClassTime.split('h').map(Number);
    const targetTime = new Date();
    const timezoneOffset = 2; // UTC+2 pour l'heure d'été en France
    console.log(`Current time: ${targetTime.toISOString()}`);
    console.log(`Timezone offset: ${timezoneOffset} hours`);
    console.log(`Target time (local): ${hours}:${minutes}:04`);
    targetTime.setHours(hours - timezoneOffset, minutes, 4, 0); // Ajouter 4 secondes
    console.log(`Target time (UTC): ${targetTime.toISOString()}`);
    
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
    
    // Tenter de cliquer sur le bouton avec retry en cas d'échec
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await page.click(`button[onclick="go_subscribe(${uniqueClassId});"]`);
            
            // Attendre un court instant pour voir si une erreur apparaît
            await new Promise(resolve => setTimeout(resolve, 1000));
            
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

// Run the script immediately
main();
