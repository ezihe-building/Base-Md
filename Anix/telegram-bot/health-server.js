const http = require('http');

function startHealthServer(port) {
    const server = http.createServer((request, response) => {
        if (request.method === 'GET' && request.url === '/health') {
            response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('ok\n');
            return;
        }

        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('not found\n');
    });

    server.listen(port, '0.0.0.0');
    return server;
}

module.exports = { startHealthServer };
