const puppeteer = require('puppeteer');

let consoleLogs = []; // Array to store console logs

function log(message) {
    consoleLogs.push(message);
    console.log(message);
}

async function loginAndClickClass() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    async function loadPage(url, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                log(`Attempting to load ${url}, attempt ${attempt}...`);
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
                log(`${url} loaded successfully.`);
                return;
            } catch (error) {
                log(`Error loading ${url} (attempt ${attempt}): ${error}`);
                if (attempt === retries) {
                    throw new Error(`Failed to load ${url} after ${retries} attempts.`);
                }
            }
        }
    }

    try {
        // Step 1: Log in
        await loadPage('https://lamontgolfiereclub.com/dashboard/');

        const email = 'j.sarquis@hotmail.com';
        const password = 'Fenetre07mon';

        await page.type('#connexion_email', email);
        await page.type('#connexion_password', password);
        await page.click('#btn-connexion');
        await page.waitForSelector('#account__logout', { timeout: 15000 }); // Confirm login
        log('Login successful!');

        // Step 2: Navigate to planning page
        await loadPage('https://lamontgolfiereclub.com/planning/');

        // Step 3: Wait for classes to load
        await page.waitForSelector('.planning__box', { timeout: 15000 });
        await new Promise(resolve => setTimeout(resolve, 2000)); // Additional delay to ensure all content is loaded

        log('Page loaded. Searching for the specific class...');

        // Calculate the target date (5 days from now)
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 5);
        const targetWeekday = targetDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
        const targetDateString = targetDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });

        log(`Target date: ${targetDateString}, Target weekday: ${targetWeekday}`);

        // Define class time based on the target weekday
        const classTimes = {
            1: "07h30", // Monday
            2: "08h40", // Tuesday
            3: "07h30", // Wednesday
            4: "08h35", // Thursday
            5: "08h35", // Friday
        };
        const targetClassTime = classTimes[targetWeekday] || "08h35"; // Default to 08h35 if the day is not mapped

        log(`Target class time: ${targetClassTime}`);

        // Find the specific class based on date, time, and name
        const uniqueClassId = await page.evaluate((targetDateString, targetClassTime) => {
            const classElements = document.querySelectorAll('.planning__box');

            for (let el of classElements) {
                const dateElement = el.querySelector('.planning__event-date');
                const timeElement = el.querySelector('.planning__event-time');
                const nameElement = el.querySelector('.planning__event-name');

                if (
                    dateElement &&
                    timeElement &&
                    nameElement &&
                    dateElement.textContent.trim().endsWith(targetDateString) &&
                    timeElement.textContent.trim().startsWith(targetClassTime) &&
                    ["hard training", "bootcamp", "cross training"].includes(nameElement.textContent.trim().toLowerCase())
                ) {
                    const onclickValue = el.getAttribute('onclick');
                    const match = onclickValue.match(/show_detail\((\d+),/);
                    if (match) {
                        return match[1]; // Return the unique class ID
                    }
                }
            }
            return null; // Class not found
        }, targetDateString, targetClassTime);

        if (!uniqueClassId) {
            log('Class not found based on the specific criteria!');
            return;
        }

        log(`Class found! Unique ID: ${uniqueClassId}`);

        const classClicked = await page.evaluate((uniqueClassId) => {
            const classElement = document.querySelector(`.planning__box[onclick*=\"show_detail(${uniqueClassId},\"]`);

            if (classElement) {
                classElement.click(); // Click the class element
                return true; // Class clicked
            }
            return false; // Class not found
        }, uniqueClassId);

        if (classClicked) {
            log(`Class with ID ${uniqueClassId} clicked.`);

            // Step 4: Wait until the class reservation time to click the reserve button
            await waitForBookingButton(page, uniqueClassId, targetClassTime);
        } else {
            log('Class not found!');
        }
    } catch (error) {
        log(`Error: ${error}`);
    } finally {
        log('Script completed. Browser will remain open for 5 seconds before closing.');
        await new Promise(resolve => setTimeout(resolve, 10000));
        await browser.close();
        log('Browser closed.');
    }
}

async function waitForBookingButton(page, uniqueClassId, targetClassTime) {
    console.log(`Waiting for booking button for class ${uniqueClassId}...`);
    
    // Attendre que le bouton soit visible
    await page.waitForSelector(
        `button[onclick="go_subscribe(${uniqueClassId});"]`,
        { timeout: 10000 }
    );
    
    // Calculer l'heure exacte d'ouverture
    const [hours, minutes] = targetClassTime.split('h').map(Number);
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

// Run the script immediately
loginAndClickClass();
