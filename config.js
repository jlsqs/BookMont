// Configuration des cours à réserver
const classes = [
    {
        day: 'mercredi',
        time: '7h30',
        targetDay: 'lundi',
        targetTime: '7h30'
    },
    {
        day: 'jeudi',
        time: '8h40',
        targetDay: 'mardi',
        targetTime: '8h40'
    },
    {
        day: 'vendredi',
        time: '7h30',
        targetDay: 'mercredi',
        targetTime: '7h30'
    },
    {
        day: 'samedi',
        time: '8h30',
        targetDay: 'jeudi',
        targetTime: '8h30'
    },
    {
        day: 'dimanche',
        time: '8h30',
        targetDay: 'vendredi',
        targetTime: '8h30'
    }
];

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
    },
    classes
}; 