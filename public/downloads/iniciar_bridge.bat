@echo off
title ProfitRTD Bridge v2.2 (32-bit IDispatch) - OpcoesProx
color 0B

cd /d "%~dp0"

echo.
echo  ====================================================
echo   ProfitRTD Bridge v2.2 - OpcoesProx.com.br
echo   Profit Pro (32-bit) - COM IDispatch - WebSocket
echo   CORRECAO: IDispatch + DispId (resolve 0x80131506)
echo  ====================================================
echo.
echo  [INFO] Diretorio: %CD%
echo.

if not exist "ProfitRTDBridge.csproj" (
    echo  [ERRO] ProfitRTDBridge.csproj nao encontrado!
    echo  Todos os arquivos devem estar na mesma pasta.
    pause & exit /b 1
)
if not exist "ProfitRTDBridge.cs" (
    echo  [ERRO] ProfitRTDBridge.cs nao encontrado!
    pause & exit /b 1
)

dotnet --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERRO] .NET SDK nao encontrado!
    echo.
    echo  Instale o .NET 6 SDK gratuito:
    echo  https://dotnet.microsoft.com/download/dotnet/6.0
    echo.
    pause & exit /b 1
)

for /f "tokens=*" %%v in ('dotnet --version') do set DOTNET_VER=%%v
echo  [OK] .NET SDK v%DOTNET_VER%
echo.

set PORT=8765

:: Se já existe o .exe publicado, usa direto
if exist "publish\ProfitRTDBridge.exe" (
    echo  [OK] Executavel 32-bit encontrado. Iniciando...
    goto run_exe
)

echo  [INFO] Baixando dependencias NuGet...
dotnet restore ProfitRTDBridge.csproj --verbosity quiet
if %errorlevel% neq 0 (
    echo  [ERRO] Falha ao baixar dependencias. Verifique internet.
    pause & exit /b 1
)

echo  [INFO] Publicando como .exe unico 32-bit (win-x86)...
echo  (Primeira vez - aguarde ~60 segundos)
echo.

dotnet publish ProfitRTDBridge.csproj ^
    -c Release ^
    -r win-x86 ^
    --self-contained true ^
    -p:PublishSingleFile=true ^
    -p:IncludeNativeLibrariesForSelfExtract=true ^
    -o publish ^
    --verbosity quiet

if %errorlevel% neq 0 (
    echo.
    echo  [ERRO] Falha ao publicar.
    echo  Tentando rodar com dotnet run...
    goto run_dotnet
)

echo.
echo  [OK] Publicado: %CD%\publish\ProfitRTDBridge.exe
echo  [INFO] Proximas vezes inicia instantaneamente!

:run_exe
echo.
echo  ====================================================
echo   INICIANDO BRIDGE (porta %PORT%)
echo  ====================================================
echo.
echo  ANTES DE CONTINUAR, confirme:
echo  [1] Profit Pro esta aberto e logado
echo  [2] RTD/DDE habilitado no Profit (Ferramentas ^> Configuracoes)
echo  [3] Profit e este Bridge rodando com o mesmo nivel
echo      (ambos como Admin OU ambos como usuario normal)
echo.
echo  Apos iniciar, acesse:
echo  https://opcoesprox.com.br/dados-ao-vivo
echo.
"publish\ProfitRTDBridge.exe" --port %PORT%
goto end

:run_dotnet
echo.
dotnet run --project ProfitRTDBridge.csproj -c Release -- --port %PORT%

:end
echo.
echo  Bridge encerrado.
pause
