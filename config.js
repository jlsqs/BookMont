module.exports = {
    credentials: {
        email: process.env.MONTGOLFIERE_EMAIL || 'j.sarquis@hotmail.com',
        password: process.env.MONTGOLFIERE_PASSWORD || 'Fenetre07mon'
    },
    urls: {
        dashboard: 'https://lamontgolfiereclub.com/dashboard/',
        planning: 'https://lamontgolfiereclub.com/planning/'
    },
    classConfig: {
        daysAhead: 5,
        classTypes: ['hard training', 'bootcamp', 'cross training'],
        classTimes: {
            1: "07h30", // Monday
            2: "08h40", // Tuesday
            3: "07h30", // Wednesday
            4: "08h35", // Thursday
            5: "08h35", // Friday
        },
        defaultTime: "08h35"
    },
    timeouts: {
        pageLoad: 15000,
        elementWait: 15000,
        browserClose: 10000
    },
    retries: {
        pageLoad: 3
    }
}; 