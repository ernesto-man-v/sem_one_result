const express = require('express');
const cors = require('cors');
const axios = require('axios');
const expressWs = require('express-ws')(express());
const app = expressWs.app;

const config = require('./config');
const port = 3001;

const keywordUrls = {
    kw_one: [
        'http://www.textfiles.com/stories/13chil.txt',
        'http://www.textfiles.com/stories/wolfcran.txt',
        'http://www.textfiles.com/stories/14.lws'
    ],
    kw_two: [
        'http://www.textfiles.com/stories/unluckwr.txt',
        'http://www.textfiles.com/stories/traitor.txt',
        'http://www.textfiles.com/stories/timetrav.txt'
    ],
    kw_three: [
        'http://www.textfiles.com/stories/shulk.txt',
        'http://www.textfiles.com/stories/shoscomb.txt',
    ],
}

function sendMsg(socket, type, data) {
    const msg = {
      type,
      data
    };
    socket.send(JSON.stringify(msg));
}

let numberOfAjaxCallPending = 0;

app.use(cors({
    origin: '*'
}));

app.use(express.static('public'));

app.ws('/ws', function(ws, req) {
    ws.on('message', async function(msg) {
        const msgObj = JSON.parse(msg);
        console.log(msgObj.type);
        switch (msgObj.type) {
            case "get_urls_for_keyword":
                console.log('get_urls_for_keyword');
                const keyword = msgObj.data.keyword;
                if (keywordUrls[keyword]) {
                    sendMsg(ws, 'urls_for_keyword', JSON.stringify({keyword, urls: keywordUrls[keyword]}))
                } else {
                    sendMsg(ws, 'error', {error: {keyword: msgObj.data.url,type: 'keword_not_found', message: `Ключевое слово ${keyword} не найдено` }});
                }
                
                break;
            case "get_url_data":
                console.log('get_url_data');
                const url = msgObj.data.url;
                const optionResponse = await axios.options(url);
                console.log('optionResponse', optionResponse.headers);
                if (numberOfAjaxCallPending + 1 <= config.maxConnections) {
                    sendMsg(ws, 'update_number_of_requests', {numberOfRequests: ++numberOfAjaxCallPending});
                    try {
                        const response = await axios.get(url, {
                            onDownloadProgress: (progressEvent) => {
                            const contentLength = progressEvent.srcElement;
                            console.log(contentLength);
                            console.log(progressEvent);
                            let percentCompleted = Math.round(
                                (progressEvent.loaded * 100) / progressEvent.total
                            );
                            console.log('percentCompleted', percentCompleted);
                            sendMsg(ws, 'get_url_data_progress', JSON.stringify({url, progress: {status: percentCompleted === 100 ? 'loaded' : 'loading', progress: percentCompleted, total: progressEvent.total, loaded: progressEvent.loaded}}))
                            },
                            maxRate: [5 * 1024, config.maxRate * 1024],
                        });
                        sendMsg(ws, 'update_number_of_requests', {numberOfRequests: --numberOfAjaxCallPending});
                        sendMsg(ws, 'get_url_data_complete', JSON.stringify({url, progress: {content: response.data}}))
                    } catch (error) {
                        sendMsg(ws, 'error', {error: {url: url, type: 'request_error', message: `Не удалось получить ответ от ${url}` }});
                    }

                } else {
                    sendMsg(ws, 'error', {error: {url: url,type: 'exceed_max_connections', message: `Превышено маклимальное количество загрузок. Макимальное количество загрузок ${config.maxConnections}` }});
                }

                break;
          }
    });
});


app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})