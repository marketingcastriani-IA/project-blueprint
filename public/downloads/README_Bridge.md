# ProfitRTD Bridge v2.0 — sem Excel

Bridge local que conecta o **Profit Pro (Nelogica)** ao app **opcoesprox.com.br**
via WebSocket, acessando o RTD **diretamente via COM** — sem precisar de Excel.

## Como funciona

```
Profit Pro
  └─ Registra COM server: "rtdtrading.rtdserver"
          ↓  COM/OLE direto (sem Excel)
  ProfitRTDBridge.exe (roda na sua máquina)
          ↓  WebSocket  ws://localhost:8765
  opcoesprox.com.br  (seu navegador)
```

## Requisitos

| O que precisa        | Observação                          |
|----------------------|-------------------------------------|
| Windows 10/11 64-bit | Obrigatório (COM é Windows-only)    |
| Profit Pro aberto    | Registra o servidor RTD no Windows  |
| .NET 6 SDK           | Só para compilar (gratuito)         |
| Excel                | ❌ NÃO precisa                      |

## Instalação rápida

### 1. Instale o .NET 6 SDK (se não tiver)
https://dotnet.microsoft.com/download/dotnet/6.0

### 2. Abra o Profit Pro e faça login

### 3. Execute o bridge
Clique com botão direito em `iniciar_bridge.bat` → **Executar como administrador**

Na primeira execução ele pergunta se quer gerar um `.exe` único.
Escolha **S** — nas próximas vezes inicia instantaneamente sem precisar do SDK.

## Estrutura de arquivos

```
ProfitRTDBridge\
  ├── iniciar_bridge.bat      ← execute este
  ├── ProfitRTDBridge.cs      ← código fonte
  ├── ProfitRTDBridge.csproj  ← projeto .NET
  └── README.md
  
  (criado automaticamente após publicar)
  └── publish\
      └── ProfitRTDBridge.exe ← executável único
```

## Protocolo WebSocket (ws://localhost:8765)

### Bridge → App
```jsonc
// Dados RTD (~1.2x por segundo)
{ "type": "rtd_data", "data": [
  { "ticker": "PETRG345", "ultimo": 2.45, "strike": 34.50,
    "negocios": 1230, "ofCompra": 2.40, "ofVenda": 2.50,
    "vInt": 1.20, "vExt": 1.25, "timestamp": 1711234567890 }
]}

// Bridge pronto
{ "type": "bridge_ready" }

// Erro
{ "type": "error", "message": "Profit Pro não encontrado." }
```

### App → Bridge
```jsonc
{ "type": "add_ticker",    "ticker": "PETRG345" }
{ "type": "remove_ticker", "ticker": "PETRG345" }
{ "type": "ping" }
```

## Troubleshooting

**"Servidor RTD não encontrado"**
→ No Profit, habilite: **Ferramentas > Configuracoes > Exportacao em Tempo Real (RTD/DDE)**.
→ Feche e abra o Profit apos habilitar.
→ Execute Profit e Bridge com a mesma permissao (ambos como admin ou ambos normal).

**App não conecta**
→ Verifique se a janela do bridge está aberta e mostra "WebSocket rodando".
→ No Windows Defender Firewall: permita `ProfitRTDBridge.exe` na rede privada.

**Dados aparecem como "—"**
→ RTD pode demorar alguns segundos na primeira subscrição.
→ Confirme que o ticker existe no Profit (ex: `PETRG345` sem espaços).

## Segurança
- Escuta **somente em localhost** — dados ficam na sua máquina
- Nenhum dado é enviado para servidores externos
