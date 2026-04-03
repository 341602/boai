# Android Cloud Build

这个项目现在已经具备“本地不装 Android 环境，直接走云端构建 APK”的基础结构。

## 已完成的前置条件

- 前端已接入 Capacitor 容器
- 已生成 Android 壳工程：
  - `frontend/android/`
- App 版已内置运行时服务能力：
  - `frontend/src/services/nativeAppService.js`
- GitHub Actions 云构建工作流已提供：
  - `.github/workflows/android-debug-apk.yml`

## 你要做的事

1. 把当前项目推到 GitHub 仓库
2. 打开 GitHub 仓库的 `Actions`
3. 运行工作流：

```text
Android Debug APK
```

4. 等待构建完成
5. 在工作流产物里下载：

```text
boai-music-debug-apk
```

## 当前产物类型

当前工作流默认产出的是：

```text
debug APK
```

优点：

- 不需要签名证书
- 适合先验证安装和功能

限制：

- 适合测试安装，不适合正式上架

## Release 构建

仓库里还提供了正式构建工作流：

```text
Android Release Build
```

对应文件：

- `.github/workflows/android-release.yml`

它会产出：

- `app-release.apk`
- `app-release.aab`

### 你需要先配置 GitHub Secrets

在仓库 `Settings -> Secrets and variables -> Actions` 里新增：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

含义：

- `ANDROID_KEYSTORE_BASE64`
  - 你的签名 keystore 文件转成 base64 后的内容
- `ANDROID_KEYSTORE_PASSWORD`
  - keystore 密码
- `ANDROID_KEY_ALIAS`
  - key alias
- `ANDROID_KEY_PASSWORD`
  - key 密码

### 本地如何生成 base64

可以在你自己的电脑上执行：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\path\to\boai-release.jks")) | Set-Clipboard
```

然后把剪贴板里的内容填进 `ANDROID_KEYSTORE_BASE64`。

## 后续如果要正式发布

现在这部分已经补上了，下一步如果你要上架：

- Google Play：优先上传 `AAB`
- 其他分发：可以直接用 `release APK`

## 关键说明

这个 App 路线不是把 Web 前端简单套壳，而是：

- UI 继续复用 Vue 前端
- App 内部直接带运行时服务能力
- 不依赖外部 Express 才能完成搜索、歌词、播放地址获取

Web 端仍然可以继续保留现在的：

- `frontend/` + `backend/`

分离部署方式。
