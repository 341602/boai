# Backend

本目录提供博爱项目使用的本地音乐 API 服务，默认启动地址为 `http://localhost:3000`。

## 安装

```powershell
npm install
```

## 启动

```powershell
npm run start
```

## 可用接口

- `GET /search?keyword=晴天&pageNo=1&pageSize=20`
- `GET /song?cid=60054701923`
- `GET /song/url?cid=60054701923`
- `GET /song/stream?cid=60054701923`
- `GET /lyric?cid=60054701923`

## 测试

```powershell
npm test
```
