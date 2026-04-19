# 🃏 Truco Mineiro Online

Jogo de Truco Mineiro multiplayer online, com visual 3D simulado, rodando no GitHub Pages.

## 🎮 Funcionalidades

- **Perfil personalizado** — foto de perfil ou emoji, nome de usuário
- **Salas multiplayer** — crie ou entre em salas, chat em tempo real
- **2 ou 4 jogadores** — modo duplas com 4 players
- **Truco Mineiro completo:**
  - Manilhas definidas pela vira
  - Força das manilhas: 7♦ < 7♥ < A♣ < 7♠ (Ouros < Copas < Paus < Espadas)
  - Truco(4) → Seis(6) → Nove(9) → Doze(12)
  - 3 rodadas por mão, desempate pela primeira rodada
  - Placar até 12 pontos
- **Visual 3D** — mesa de baize em perspectiva, cartas animadas em fan

## 🚀 Como colocar no GitHub Pages

### Passo 1 — Crie um projeto Firebase

1. Acesse [firebase.google.com](https://firebase.google.com) e faça login
2. Clique em **"Adicionar projeto"**
3. Dê um nome (ex: `truco-mineiro`)
4. Pule o Google Analytics (opcional)

### Passo 2 — Configure o Realtime Database

1. No painel do Firebase, vá em **Build → Realtime Database**
2. Clique em **"Criar banco de dados"**
3. Escolha **modo de teste** (por agora)
4. Selecione a região mais próxima

### Passo 3 — Configure as Regras do Database

No Firebase, vá em **Realtime Database → Regras** e cole:
```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```
Clique em **Publicar**.

### Passo 4 — Copie as credenciais

1. No Firebase, vá em **Configurações do projeto** (ícone de engrenagem)
2. Em **"Seus apps"**, clique em **"</ > Web"**
3. Registre o app (nome qualquer)
4. Copie o objeto `firebaseConfig`

### Passo 5 — Cole as credenciais

Abra o arquivo `js/firebase-config.js` e substitua:
```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

### Passo 6 — Suba para o GitHub Pages

1. Crie um repositório no GitHub (ex: `truco-mineiro`)
2. Envie todos os arquivos:
```bash
git init
git add .
git commit -m "Truco Mineiro Online"
git remote add origin https://github.com/SEU_USUARIO/truco-mineiro.git
git push -u origin main
```
3. No repositório, vá em **Settings → Pages**
4. Em **Source**, selecione **main branch / root folder**
5. Clique em **Save**

Seu jogo estará em: `https://SEU_USUARIO.github.io/truco-mineiro`

---

## 📁 Estrutura de arquivos

```
truco-mineiro/
├── index.html              # Página principal
├── css/
│   └── style.css           # Estilos (tema verde-ouro casino)
├── js/
│   ├── firebase-config.js  # ⚠️ Configure aqui suas credenciais
│   ├── profile.js          # Perfil do usuário (nome, avatar)
│   ├── rooms.js            # Gerenciamento de salas
│   ├── truco-engine.js     # Motor do jogo (regras completas)
│   ├── renderer.js         # Renderização 3D da mesa
│   └── main.js             # Inicialização e controles
└── README.md
```

## 🃏 Regras Implementadas

### Baralho
- 40 cartas: A, 2, 3, 4, 5, 6, 7, J, Q, K (sem 8, 9, 10)
- 4 naipes: Paus ♣, Copas ♥, Espadas ♠, Ouros ♦

### Manilhas
A manilha é a carta seguinte à vira na ordem:
`4 < 5 < 6 < 7 < J < Q < K < A < 2 < 3`

Força das manilhas (menor para maior):
- 7♦ Ouros (mais fraca)
- 7♥ Copas
- A♣ Paus  
- 7♠ Espadas (mais forte — "zap")

### Pontuação Truco Mineiro
- Sem pedir truco: mão vale **1 ponto**
- Truco: **4 pontos**
- Seis: **6 pontos**
- Nove: **9 pontos**
- Doze: **12 pontos**
- Quem chegar a **12 pontos** vence!

### Rodadas
- Cada mão tem até 3 rodadas
- Quem vencer 2 rodadas ganha a mão
- Em empate na 1ª rodada: 2ª rodada decide
- Empate geral: quem jogou primeiro ganha
