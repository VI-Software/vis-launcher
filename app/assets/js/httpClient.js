const got = require('got');

const httpClient = got.extend({
    prefixUrl: API_BASE_URL,
    timeout: 5000,
    headers: {
        'User-Agent': 'VI Software Launcher/' + process.version,
        'Application-Name': 'VI Software Launcher',
        'Application-Version': process.version
    },
    family: 4, // For ISPs with no IPv6 Compatibility
    responseType: 'json',
    hooks: {
        afterResponse: [
            (response) => {
                return response.body;
            }
        ],
        beforeError: [
            (error) => {
                return Promise.reject(error);
            }
        ]
    }
});

module.exports = httpClient;