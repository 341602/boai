# App Native Bridge Contract

这个文件约定了 `App` 版前端与“内置服务层”之间的桥接协议。

目标：

- `Web` 版继续调用 `backend/` 的 Express API
- `App` 版不依赖外部 Express，而是调用安装包内的运行时服务能力

## 前端运行时切换

前端入口在：

- `frontend/src/services/musicApi.js`

运行时分两种：

- `web`
- `native`

只要宿主环境暴露以下任一对象，前端就会自动切到 `native`：

- `window.__BOAI_NATIVE__`

当前项目里，`window.__BOAI_NATIVE__` 已经由：

- `frontend/src/services/capacitorBridge.js`
- `frontend/src/services/nativeAppService.js`

在 App 运行时自动初始化。

## 需要提供的方法

App 运行时服务至少需要实现这些方法：

### `searchSongs(payload)`

输入：

```js
{
  keyword: '梁博',
  type: 'song',
  pageNo: 1,
  pageSize: 20
}
```

返回：

```js
{
  list: [
    {
      id: '...',
      songId: '...',
      cid: '...',
      name: '...',
      album: {
        id: '...',
        name: '...',
        picUrl: '...'
      },
      artists: [{ id: '...', name: '...' }],
      lyricUrl: ''
    }
  ],
  total: 401
}
```

### `getSongDetail(payload)`

输入：

```js
{ cid: '60054701923' }
```

返回结构需与当前 Web 版 `/song` 接口一致。

### `getLyric(payload)`

输入：

```js
{ cid: '60054701923' }
```

返回：

```js
'[00:00.00] ...'
```

### `getSongUrl(payload)`

输入：

```js
{ cid: '60054701923' }
```

返回：

```js
'https://...'
```

### `resolveStreamUrl(payload)`

输入：

```js
{ cid: '60054701923' }
```

返回：

```js
'https://...' // 或原生可播放的本地桥接地址
```

如果原生侧没有提供 `resolveStreamUrl`，前端会回退到 `getSongUrl`。

## 推荐实现

当前推荐实现是：

- 用 `Capacitor` 容器承载 Vue 前端
- 用 `CapacitorHttp` 在 App 内直接请求咪咕接口
- 将“后端能力”以安装包内运行时服务的形式提供给前端

如果后面要进一步加强，也可以再补 Android 原生插件层。

原因：

- 这样 `App` 安装包内可以真正自带“后端能力”
- 前端页面层不需要再区分太多逻辑
- `Web` 端仍然可以保留现在的 Express 代理结构
