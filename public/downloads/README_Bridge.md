# ProfitRTD Bridge v3.1 — dynamic COM, sem Excel

Bridge local que conecta o **Profit Pro (Nelogica)** ao app **opcoesprox.com.br**
via WebSocket, acessando o RTD **diretamente via COM** — sem precisar de Excel.

## Histórico de versões

| Versão | Erro | Causa | Fix |
|--------|------|-------|-----|
| v2.0 | REGDB_E_CLASSNOTREG | Bridge era 64-bit, COM do Profit é 32-bit | win-x86 |
| v2.1/2.2 | Specified cast is not valid | `(IRtdServer)instance` falha — Profit não expõe vtable padrão | Tentar IDispatch |
| v3.0 | Specified cast is not valid | Cast para qualquer interface falha — Profit usa wrapper COM nativo | **dynamic late binding** |
| v3.1 | Could not convert argument 0 for call to ServerStart | Callback COM sem IID esperado para `IRTDUpdateEvent` | **Interface COM explícita + callback tipado** |

## O que mudou na v3.1

- **Callback COM com IID oficial do RTD** (`A43788C1-D91B-11D3-8F39-00C04F3651B8`) para o `ServerStart` aceitar o argumento sem erro de conversão.
- **Fallback de inicialização**: tenta callback tipado e, se necessário, fallback como `object`.
- Mensagens de erro atualizadas para o fluxo real do Profit (tela **Exportar em Tempo Real (RTD/DDE)**).

## O que mudou na v3.0

- **`dynamic rtd`** — em vez de `(IRtdServer)instance`, o objeto fica como `dynamic`. O CLR chama `rtd.ServerStart()`, `rtd.ConnectData()` etc. diretamente pelo nome via IDispatch, sem nenhum cast de interface.
- **`Microsoft.CSharp`** no `.csproj` — necessário para `dynamic` funcionar em .NET 6+.
- **`.bat` apaga `publish\`** automaticamente — garante recompilação do zero em 32-bit com as correções.

## Como funciona

```
Profit Pro (32-bit)
  └─ COM ProgID: RTDTrading.RTDServer
          ↓  dynamic late binding (IDispatch)
  ProfitRTDBridge.exe (win-x86, STA thread)
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

O bat apaga qualquer compilação anterior, recompila em 32-bit e gera o `.exe`.

## Protocolo WebSocket (ws://localhost:8765)

### Bridge → App
```jsonc
{ "type": "rtd_data", "data": [
  { "ticker": "PETRG345", "ultimo": 2.45, "strike": 34.50,
    "negocios": 1230, "ofCompra": 2.40, "ofVenda": 2.50,
    "vInt": 1.20, "vExt": 1.25, "timestamp": 1711234567890 }
]}
{ "type": "bridge_ready" }
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
→ No Profit, abra **Exportar em Tempo Real (RTD/DDE)**, selecione **RTD** e marque **Ativar transferência de dados**. Clique **OK** (ou **Copiar**) e reinicie o Profit.
→ Execute Profit e Bridge com a mesma permissão (ambos Admin ou ambos normal).

**App não conecta**
→ Verifique se a janela do bridge mostra "WebSocket rodando".
→ Permita `ProfitRTDBridge.exe` no Windows Defender Firewall.

**Dados aparecem como "—"**
→ RTD pode demorar alguns segundos na primeira subscrição.
→ Confirme que o ticker existe no Profit (ex: `PETRG345` sem espaços).

## Segurança
- Escuta **somente em localhost** — dados ficam na sua máquina
- Nenhum dado é enviado para servidores externos
