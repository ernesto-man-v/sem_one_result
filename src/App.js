import React from 'react';
import { PrimeReactProvider} from 'primereact/api'
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { ListBox } from 'primereact/listbox';
import { Card } from 'primereact/card';
import { ProgressBar } from 'primereact/progressbar';
import { Toast } from 'primereact/toast';
import { Badge } from 'primereact/badge';
import { Tag } from 'primereact/tag';
import 'primereact/resources/themes/nano/theme.css'; 
import './App.css';

let wSocket;

function App() {

  const [keyword, setKeyword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [urlsForKeyword, setUrlsForKeyword] = React.useState([]);
  const [selectedUrlsForKeyword, setSelectedUrlsForKeyword] = React.useState({});
  const [numberOfRequests, setNumberOfRequests] = React.useState(0);
  const [clearingStore, setClearingStore] = React.useState(false);
  const [reopenWS, setReopenWS] = React.useState(false);
  const onKeywordChange = (e) => {
    setKeyword(e.target.value);
  }
  const toast = React.useRef(null);

  function sendMsg(socket, type, data) {
    const msg = {
      type,
      data
    };
    if (socket) {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(msg));
      } else {
        setLoading(false);
        toast.current.show({severity:'error', summary: '', detail: 'Соедниенение не готово. Попробуйте позднее.', life: 3000});
        if ((socket.readyState === 2 || socket.readyState === 3)) {
          setReopenWS(true);
          wSocket = new WebSocket("ws://localhost:3001/ws");
          toast.current.show({severity:'success', summary: '', detail: 'Открыто новое websocket соединение. Повторите операцию.', life: 3000});
        }
      }
    } else {
      setReopenWS(true);
      wSocket = new WebSocket("ws://localhost:3001/ws");
      toast.current.show({severity:'success', summary: '', detail: 'Открыто новое websocket соединение. Повторите операцию.', life: 3000});
      setLoading(false);
    }
      
  }

  React.useEffect(() => {
    // оплучаем данные из local storage
    const urls = localStorage.getItem('urls');
    // console.log('localStorage', JSON.parse(urls));
    if (urls) {
      setUrlsForKeyword(JSON.parse(urls).map((item) => {
        if (item.data !== null && item.data !== undefined) {
          return {
            ...item,
            status: 'loaded-from-store'
          }
        }
        return item;
      }));
    }
    setReopenWS(true);
    wSocket = new WebSocket("ws://localhost:3001/ws")
  }, []);

  React.useEffect(() => {
    if (reopenWS) {
      wSocket.onclose = (event) => {
        setLoading(false);
        toast.current.show({severity:'error', summary: '', detail: 'websocket закрыт', life: 3000});
        wSocket = null;
        console.log("Error occurred.", event);
     }
     wSocket.onerror = (event) => {
        wSocket.close();
        console.log('sokect error', event);
      }
      wSocket.onmessage = (event) => {
        // console.log('event', event);
        const msg = JSON.parse(event.data);
      
        switch (msg.type) {
          case "urls_for_keyword":
            // console.log('msg.data', msg.data);
            const data = JSON.parse(msg.data);
            // console.log('data', data);
            setUrlsForKeyword(prev => prev.concat(
              (data.urls || []).filter(
                item => {
                  return !prev.find(elem => {
                    return elem.name === item
                  })
                })
                .map((item, index) => {
                    const a = 1;
                    return {
                      code: index,
                      name: item,
                      status: 'not-loaded',
                      keyword: data.keyword
                    };
                  })
              )
            );
            setLoading(false);
            break;
          case "get_url_data_progress": {
            // console.log('get_url_data_progress msg.data', msg);
            const data = JSON.parse(msg.data);
            // console.log('data', data);
            setUrlsForKeyword((prev) => prev && prev.map(item => {
              if (item.name === data.url) {
                return {
                  ...item,
                  status: data.progress.status,
                  progress: data.progress.progress,
                  total: data.progress.total,
                  loaded: data.progress.loaded
                };
              }
                return item;
            }));
            break;
          }
          case "get_url_data_complete": {
            // console.log('get_url_data_complete msg.data', msg);
            // console.log(msg);
            const data = JSON.parse(msg.data);
            // console.log(data.progress.content);
            setUrlsForKeyword((prev) => prev && prev.map(item => {
              if (item.name === data.url) {
                return {
                  ...item,
                  data: data.progress.content,
                };
              }
                return item;
            }));
            break;
          }
          case 'update_number_of_requests': {
            // console.log('update_number_of_requests msg', msg);
            setNumberOfRequests(msg.data.numberOfRequests);
            break;
          }
          case 'error': {
            // console.log('error msg', msg);
            setUrlsForKeyword((prev) => prev && prev.map(item => {
              if (item.name === msg.data.error.url) {
                return {
                  ...item,
                  status: 'not-loaded',
                  data: null,
                };
              }
                return item;
            }));
            setLoading(false);
            toast.current.show({severity:'error', summary: '', detail: msg.data.error.message, life: 3000});
            break;
          }
        }
      }
      setReopenWS(false);
    }
  }, [reopenWS])

  React.useEffect(() => {
    // получаем данные из local storage
    // console.log('urlsForKeyword', urlsForKeyword);
    localStorage.setItem('urls', JSON.stringify(urlsForKeyword))
  }, [urlsForKeyword]);

  React.useEffect(() => {
    if (clearingStore) {
      localStorage.removeItem('urls');
      setUrlsForKeyword([]);
      setSelectedUrlsForKeyword({});
      setClearingStore(false);
    }
  }, [clearingStore]);

  const onClearStoreClick = async () => {
    setClearingStore(true);
  }

  const onGetUrlsClick = async () => {
    setLoading(true);

    try {
      sendMsg(wSocket, 'get_urls_for_keyword', {keyword})
    } catch (error) {
      // console.log(error);
      setLoading(false);
    }
  };

  const onGetUrlData = (option) => async () => {
    if (navigator.onLine) {
      setUrlsForKeyword((prev) => prev && prev.map(item => {
        if (item.name === option.name) {
          return {
            ...item,
            status: 'loading',
            progress: 0
          };
        }
          return item;
      }));

      sendMsg(wSocket, 'get_url_data', {url: option.name});
    } else {
      toast.current.show({severity:'error', summary: '', detail: 'Нет подключения к сети.', life: 3000});
    }
  };

  const urlTemplate = (option) => {
    let renderDownloadStatus;

    switch (option.status) {
      case 'loading':
        renderDownloadStatus = () => <Tag severity="warning" value="Загружаю"></Tag>;
        break;
      case 'loaded':
        renderDownloadStatus = () => <Tag severity="success" value="Загружено"></Tag>;
        break;
      case 'loaded-from-store':
        renderDownloadStatus = () => <Tag value="Загружено из локального хранилища"></Tag>;
        break;
      case 'not-loaded':
        renderDownloadStatus = () => <Tag severity="info" value="Не загружено"></Tag>;
        break;
      default:
        renderDownloadStatus = () => <Tag severity="info" value="Не загружено"></Tag>;
        break;
    }
    const valueTemplate = (loaded, total) => (value) => {
      return (
          <React.Fragment>
              {loaded}/<b>{`${total} B`}</b>:<span>{` ${value}%`}</span>
          </React.Fragment>
      );
    };

    return (
        <div className="flex align-items-center">
            {renderDownloadStatus()}
            {
              option.status === 'not-loaded' && <div>
                <Button
                  label="Скачать"
                  icon="pi pi-check" 
                  onClick={onGetUrlData(option)}
                />
              </div>
            }
            <div>{option.name}</div>
            <ProgressBar value={option.progress} displayValueTemplate={valueTemplate(option.loaded, option.total)}></ProgressBar>
        </div>
    );
  };
  const isContentBlockVisible = selectedUrlsForKeyword && selectedUrlsForKeyword.data !== null && selectedUrlsForKeyword.data !== undefined;
  const contentTitle = selectedUrlsForKeyword && (Object.keys(selectedUrlsForKeyword).length === 0 ? '' : `${selectedUrlsForKeyword.keyword} - ${selectedUrlsForKeyword.name}`);

  return (
    <div className="App">
      <PrimeReactProvider>
      <span className='keyword-block'>
        <label htmlFor="keyword-input">Ключевое слово</label>
          <InputText
            id="keyword-input"
            value={keyword}
            onChange={onKeywordChange}
          />
      </span>


        <Button
          label="Получить urls"
          icon="pi pi-check"
          loading={loading}
          onClick={onGetUrlsClick}
        />
        <div className='badge'>
          <span className='badge-label'>Количество активных потоков:</span>
          <Badge value={numberOfRequests} size="large" severity="success"></Badge>
        </div>
        <Button
          label="Очистить хранилище"
          icon="pi pi-check"
          onClick={onClearStoreClick}
        />
        {
          <ListBox
            itemTemplate={urlTemplate}
            value={selectedUrlsForKeyword}
            onChange={(e) => setSelectedUrlsForKeyword(e.value)}
            options={urlsForKeyword}
            optionLabel="name"
            className="w-full md:w-14rem"
          />
        }
        {
          isContentBlockVisible && <Card title={contentTitle}>
            <p className="m-0">
              {selectedUrlsForKeyword.data}
            </p>
          </Card>
        }
        <Toast ref={toast} />
      </PrimeReactProvider>
    </div>
  );
}

export default App;
