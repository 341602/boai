# Android 云打包与更新

这份说明按“小白可用”的方式整理，目标只有两个：

1. 你能稳定打出正式 `release APK`
2. 手机里的 App 能自己检查更新并下载安装

## 先记住一句话

- `Debug APK`：只适合测试，不适合做正式更新
- `Release APK`：正式安装包，后面 App 自动更新必须用它

## 第一次需要做什么

### 1. 准备签名文件

你需要一个固定的 Android 签名文件，也就是 `keystore` / `jks`。

以后每一次正式发版都必须用同一个签名，否则手机不能覆盖升级。

如果你已经有 `.jks` 文件，继续下一步。

### 2. 把签名配置到 GitHub

进入你的仓库：

`Settings -> Secrets and variables -> Actions`

新增这 4 个 Secrets：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

#### `ANDROID_KEYSTORE_BASE64` 怎么来

在你电脑上执行：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\path\to\boai-release.jks")) | Set-Clipboard
```

然后把剪贴板内容粘贴到 `ANDROID_KEYSTORE_BASE64`。

## 每次发新版，你只需要做这几步

### 第 1 步：改版本号

打开：

- `frontend/package.json`

把：

```json
"version": "1.0.7"
```

改成新版本，比如：

```json
"version": "1.0.8"
```

注意：

- 每次发版都要递增
- App 里的更新比较就是靠这个版本号

### 第 2 步：提交并推送到 GitHub

```powershell
git add .
git commit -m "Release v1.0.8"
git push
```

### 第 3 步：运行正式构建

打开 GitHub 仓库：

`Actions -> Android Release Build -> Run workflow`

这条工作流会自动做这些事：

- 打正式 `release APK`
- 打 `release AAB`
- 自动生成 `update.json`
- 自动把 `update.json` 同步到仓库固定地址 `app-updates/update.json`
- 自动创建或更新 GitHub Release

### 第 4 步：等构建完成

完成后你会在 GitHub Release 里看到：

- `boai-music-v1.0.8-release.apk`
- `boai-music-v1.0.8-release.aab`
- `update.json`

同时仓库里还会更新：

- `app-updates/update.json`

这个固定地址是 App 检查更新时最优先读取的，比直接访问 GitHub Release API 更稳定。

## 手机里的 App 是怎么更新的

App 设置页里点“检查更新”后，会按这个顺序去找更新：

1. `UPDATE_MANIFEST_URLS`
2. `UPDATE_RELEASE_API_URLS`
3. 内置的 GitHub 代理地址
4. 最后才尝试 GitHub 直连

如果发现新版本：

1. 弹出更新提示
2. 点“立即更新”
3. App 下载 APK
4. 下载完成后自动打开系统安装界面
5. 你点安装，完成升级

注意：

- Android 普通应用不能完全静默安装
- 最后仍然需要你在系统安装界面确认一次

## 国内访问 GitHub 不稳定怎么办

项目已经内置了多代理兜底，但最稳的方案仍然是：

- 你自己的服务器放 `update.json`
- 你自己的服务器放 APK 下载链接

配置文件在：

- `frontend/public/runtime-config.js`

### 最推荐的配置方式

```js
window.__BOAI_CONFIG__ = {
  API_BASE_URL: '',
  UPDATE_MANIFEST_URLS: [
    'https://your-domain.com/boai/update.json',
  ],
  UPDATE_RELEASE_API_URLS: [],
  UPDATE_DOWNLOAD_PROXY_PREFIXES: [],
  UPDATE_DOWNLOAD_URLS: [
    'https://your-domain.com/boai/boai-music-latest.apk',
  ],
}
```

这样就基本不依赖 GitHub 代理了。

## 这 4 个配置项分别是什么

### `UPDATE_MANIFEST_URLS`

更新清单地址，优先级最高。

适合放：

- 你自己的 `update.json`

### `UPDATE_RELEASE_API_URLS`

备用的“最新版本接口”地址。

适合放：

- 你自己的发布接口
- GitHub Releases API 的代理地址

### `UPDATE_DOWNLOAD_PROXY_PREFIXES`

下载 APK 时给 GitHub 下载地址套一层代理前缀。

适合放：

- `https://ghproxy.net/`
- `https://mirror.ghproxy.com/`

### `UPDATE_DOWNLOAD_URLS`

直接可下载的 APK 地址，优先级最高。

适合放：

- 你自己服务器上的 APK 直链

## 最简单的使用建议

如果你现在还没有自己的服务器：

1. 先用 GitHub Release 跑通正式包
2. 手机安装 `release APK`
3. 在 App 里测试检查更新

如果你后面有自己的服务器：

1. 把 `update.json` 放到你服务器
2. 把 APK 放到你服务器
3. 改 `frontend/public/runtime-config.js`

这样国内更新体验会更稳。

## 你最需要避免的坑

### 1. 不要拿 `debug APK` 做更新

`debug` 只是测试用，不能作为长期升级链。

### 2. 不要换签名文件

只要签名变了，手机就不能覆盖安装升级。

### 3. 不要忘记改版本号

如果版本号没变，App 会认为没有新版本。

## 给你的最短流程

以后你每次发新版本只做这 4 件事：

1. 改 `frontend/package.json` 里的 `version`
2. `git push`
3. 跑 `Android Release Build`
4. 等 GitHub Release 生成完成

然后手机里点“检查更新”就行。
