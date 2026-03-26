@echo off
title ProfitRTD Bridge - OpcoesProx
color 0B

echo.
echo  ============================================
echo   ProfitRTD Bridge - OpcoesProx.com.br
echo   Nelogica Profit Pro + WebSocket Bridge
echo  ============================================
echo.

:: Verifica se .NET 6 SDK esta instalado
dotnet --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERRO] .NET SDK nao encontrado!
    echo.
    echo  Instale o .NET 6 SDK em:
    echo  https://dotnet.microsoft.com/download/dotnet/6.0
    echo.
    pause
    exit /b 1
)

echo  [OK] .NET SDK encontrado.
echo.

:: Porta padrao
set PORT=8765

:: Tickers iniciais (pode editar aqui ou passar via app)
set TICKERS=

echo  [INFO] Restaurando pacotes NuGet...
dotnet restore ProfitRTDBridge.csproj >nul 2>&1

echo  [INFO] Compilando bridge...
dotnet build ProfitRTDBridge.csproj -c Release --nologo -v q

if %errorlevel% neq 0 (
    echo.
    echo  [ERRO] Falha na compilacao. Verifique se o Excel esta instalado.
    pause
    exit /b 1
)

echo.
echo  [INFO] Iniciando bridge na porta %PORT%...
echo  [INFO] Abra o Profit Pro antes de continuar.
echo.
echo  Acesse o app em: https://opcoesprox.com.br
echo  O app conectara automaticamente em: ws://localhost:%PORT%
echo.

dotnet run --project ProfitRTDBridge.csproj -c Release -- --port %PORT% --tickers %TICKERS%

pause
