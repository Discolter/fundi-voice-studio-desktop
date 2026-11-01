// Cloud connectivity is not equivalent to a saved workspace or a stored token.
// A successful server response is required before saying "Синхронизировано".
export function cloudHealth(cloud={},taskSyncError='',native=true,now=Date.now()){
  if(!native)return {code:'local',label:'Локальный режим',description:'Облачная проверка доступна в Windows Studio.'};
  if(!cloud.connected)return {code:'disconnected',label:'Не подключено',description:'Подключи Fundi Voice Cloud во вкладке «Доступ актёров».'};
  const last=Date.parse(cloud.lastStatus||''),fresh=Number.isFinite(last)&&now-last>=-10000&&now-last<=95000;
  const lastText=fresh?'Последний ответ сервера: '+new Date(last).toLocaleString('ru-RU')+'. ':'Последний подтверждённый ответ сервера давно не получен. ';
  const networkError=/(?:нет ответа|временно недоступ|timed?\s*out|offline|соединени|подключени|network|сетев|сервера запускается)/i.test(cloud.error||'');
  if(taskSyncError)return {code:'error',label:'Ошибка синхронизации',description:taskSyncError+' Проверка согласования ролей и задач необходима.'};
  if(cloud.conflict)return {code:'error',label:'Конфликт данных',description:cloud.error||'Роли изменены в разных клиентах. Публикация остановлена.'};
  if(cloud.error)return {code:networkError?'offline':'error',label:networkError?'Нет ответа сервера':'Ошибка синхронизации',description:cloud.error};
  if(cloud.busy)return {code:'checking',label:'Синхронизация…',description:lastText+'Проверяем сервер или отправляем данные.'};
  if(!fresh)return {code:'offline',label:'Нет ответа сервера',description:lastText+'Сервер может запускаться, спать или быть недоступным. Это не доказательство сна.'};
  if(cloud.pending||cloud.roleSyncReady===false)return {code:'pending',label:'Ожидает отправки',description:lastText+'Изменения ещё не подтверждены сервером.'};
  return {code:'online',label:'Синхронизировано',description:lastText+'Сервер отвечает, очередь ролей пуста, ошибок согласования нет.'};
}
