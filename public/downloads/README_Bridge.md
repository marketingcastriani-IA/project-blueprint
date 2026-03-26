# ProfitRTD Bridge — OpçõesPROX

Bridge local que conecta o **Profit Pro (Nelogica)** ao app web **opcoesprox.com.br** via WebSocket,
transmitindo dados RTD em tempo real sem necessidade de copiar/colar.

## Arquitetura

```
Profit Pro (RTD Server)
        ↓  COM/OLE
    Excel Interop  ←── ProfitRTDBridge.exe (Windows)
        ↓  WebSocket ws://localhost:8765
    opcoesprox.com.br  (navegador)
```

## Requisitos

| Componente | Versão |
|-----------|--------|
| Windows | 10 ou 11 (64-bit) |
| .NET SDK | 6.0+ |
| Microsoft Excel | qualquer versão (2013+) |
| Profit Pro | qualquer versão com RTD ativo |

## Instalação

### 1. Instale o .NET 6 SDK
Baixe em: https://dotnet.microsoft.com/download/dotnet/6.0

### 2. Compile o bridge
```bash
dotnet build ProfitRTDBridge.csproj -c Release
```

Ou simplesmente execute `iniciar_bridge.bat` que compila e roda automaticamente.

### 3. Execute como Administrador
```
iniciar_bridge.bat
```

## Uso

1. Abra o **Profit Pro** e faça login
2. Execute o bridge (`iniciar_bridge.bat`)
3. Acesse **opcoesprox.com.br → Dados ao Vivo**
4. O app conecta automaticamente em `ws://localhost:8765`
5. Adicione tickers pelo app — o bridge começa a monitorar imediatamente

## Protocolo WebSocket

### Bridge → App (mensagens enviadas)

```json
// Dados RTD em tempo real (a cada ~800ms)
{ "type": "rtd_data", "data": [
    {
      "ticker": "PETRG345",
      "ultimo": 2.45,
      "strike": 34.50,
      "negocios": 1230,
      "ofCompra": 2.40,
      "ofVenda": 2.50,
      "vInt": 1.20,
      "vExt": 1.25,
      "timestamp": 1711234567890
    }
]}

// Lista de tickers monitorados
{ "type": "tickers", "data": ["PETRG345", "PETRG340"] }

// Erro
{ "type": "error", "message": "Falha ao conectar com Excel/RTD" }
```

### App → Bridge (comandos recebidos)

```json
// Adicionar ticker
{ "type": "add_ticker", "ticker": "PETRG345" }

// Remover ticker
{ "type": "remove_ticker", "ticker": "PETRG345" }

// Ping/Pong
{ "type": "ping" }
```

## Campos RTD mapeados

| Campo App | Código RTD | Descrição |
|-----------|-----------|-----------|
| `ultimo`  | `ULT`     | Último preço negociado |
| `strike`  | `PEX`     | Strike/preço de exercício |
| `negocios`| `NEG`     | Número de negócios |
| `ofCompra`| `OCP`     | Oferta de compra |
| `ofVenda` | `OVD`     | Oferta de venda |
| `vInt`    | `VINT`    | Valor intrínseco |
| `vExt`    | `VEXT`    | Valor extrínseco |

## Segurança

- O bridge escuta **apenas em localhost (127.0.0.1)**
- Nenhum dado é enviado para a internet
- O app web só acessa `ws://localhost:8765`

## Troubleshooting

**"Falha ao iniciar Excel/RTD"**
- Verifique se o Excel está instalado (não basta o Office Web)
- Verifique se o Profit Pro está aberto e logado
- Execute como Administrador

**App não conecta**
- Verifique se o bridge está rodando (janela do console aberta)
- Verifique se a porta 8765 não está bloqueada pelo firewall
- No Windows Defender Firewall: permita o `ProfitRTDBridge.exe`

**Dados aparecem como "—"**
- O RTD pode demorar alguns segundos para inicializar
- Verifique se o ticker está correto (ex: `PETRG345` e não `PETRG 345`)
- Certifique-se que o papel está sendo monitorado no Profit Pro
