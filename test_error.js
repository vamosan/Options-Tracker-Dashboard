const http = require('http');

http.get('http://127.0.0.1:3008', res => {
    let data = '';
    res.on('data', chunk => {
        data += chunk;
    });
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);

        // Look for Next.js error digest or message
        if (data.includes('Application error: a client-side exception has occurred')) {
            console.log('CLIENT SIDE EXCEPTION FOUND');
        }

        const nextErr = data.match(/"message":"(.*?)"/g);
        if (nextErr) {
            console.log('NEXT ERRORS:');
            console.log(nextErr.slice(0, 5).join('\n'));
        } else {
            const errMatch = data.match(/Error: (.*?)</);
            if (errMatch) {
                console.log('RAW ERR:', errMatch[1]);
            } else {
                // Just print a snippet of the page to see what's wrong
                console.log('HTML SNIPPET:', data.substring(0, 1000));
            }
        }
    });
}).on('error', e => {
    console.error('Fetch Error:', e.message);
});
