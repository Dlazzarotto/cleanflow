# CleanFlow — App da equipe (iOS e Android)

App nativo somente para a **equipe de campo**. A gestão continua no navegador.

O app carrega o sistema publicado em `cleanflows.app`, então **correções no site
chegam ao celular sem publicar versão nova na loja**. Só é preciso republicar
quando mudar algo nativo (ícone, permissões, plugins).

---

## 1. Instalar as ferramentas (uma vez)

No Mac, abra o Terminal:

```bash
# Xcode: instalar pela App Store (grátis, ~15 GB), depois:
xcode-select --install
sudo xcodebuild -license accept

# Ferramenta de linha de comando do iOS
sudo gem install cocoapods
```

Para Android (opcional agora): baixe o **Android Studio** em
https://developer.android.com/studio

---

## 2. Preparar o projeto (uma vez)

Na pasta do projeto:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npm install @capacitor/geolocation @capacitor/push-notifications @capacitor/splash-screen @capacitor/status-bar

npx cap add ios
npx cap add android
npx cap sync
```

---

## 3. Rodar no seu iPhone (sem loja)

```bash
npx cap open ios
```

O Xcode abre. Então:

1. Conecte o iPhone no Mac pelo cabo
2. No topo do Xcode, escolha seu iPhone na lista de dispositivos
3. Painel esquerdo → clique em **App** → aba **Signing & Capabilities**
   - Marque **Automatically manage signing**
   - Em **Team**, escolha sua conta Apple (basta um Apple ID comum para testar)
4. Clique no botão ▶ (Play)

Na primeira vez o iPhone recusa: vá em **Ajustes → Geral → VPN e Gerenciamento
de Dispositivo → confie no desenvolvedor**. Depois o app abre normalmente.

> Sem a conta paga ($99/ano), o app funciona por **7 dias** e precisa ser
> reinstalado. Com a conta paga, dura 1 ano e pode ir para a loja.

---

## 4. Permissões de localização em segundo plano

### iOS — `ios/App/App/Info.plist`

Adicione antes de `</dict>`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Usamos sua localização para registrar chegada e conclusão nas casas atendidas.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Com a localização em segundo plano, o app registra a saída da casa mesmo com o celular no bolso.</string>
<key>NSCameraUsageDescription</key>
<string>A câmera é usada para registrar fotos de ocorrências no local do serviço.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Salvamos as fotos das ocorrências registradas.</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
  <string>fetch</string>
</array>
```

### Android — `android/app/src/main/AndroidManifest.xml`

Dentro de `<manifest>`, antes de `<application>`:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
```

---

## 5. Depois de qualquer mudança nativa

```bash
npx cap sync
npx cap open ios      # ou: npx cap open android
```

Mudanças **só no site** (telas, textos, regras) não precisam disso — basta o
deploy normal na Vercel.

---

## 6. Publicar nas lojas (quando decidir)

**Antes de publicar, providencie:**
- Conta Apple Developer — https://developer.apple.com/programs ($99/ano, aprovação leva de 2 a 7 dias)
- Google Play Console — https://play.google.com/console ($25, uma vez)
- Página de política de privacidade (obrigatória nas duas lojas)
- Capturas de tela do app em funcionamento
- Ícone 1024×1024 sem transparência

**iOS:** Xcode → Product → Archive → Distribute App → App Store Connect
**Android:** `npx cap build android` → enviar o `.aab` no Play Console

> A Apple costuma rejeitar a primeira submissão por detalhes de formulário.
> É normal — corrija o que apontarem e reenvie.

---

## Observações

- **appId** `app.cleanflows.equipe` — não mude depois de publicar, é a identidade do app na loja.
- O app aponta para `cleanflows.app`. Se o domínio mudar, ajuste em `capacitor.config.ts` e republique.
- Enquanto o domínio não estiver ativo, troque a URL para o endereço da Vercel.
