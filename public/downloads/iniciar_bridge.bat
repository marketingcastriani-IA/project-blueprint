@echo off
title ProfitRTD Bridge v3.0 - OpcoesProx
color 0B

cd /d "%~dp0"

echo.
echo  ====================================================
echo   ProfitRTD Bridge v3.0 - OpcoesProx.com.br
echo   Profit Pro (32-bit) - dynamic COM - WebSocket
echo   CORRECAO: dynamic late binding (resolve cast error)
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

:: IMPORTANTE: apaga publish antiga (versão 64-bit ou com cast errado)
:: para forçar nova compilação 32-bit com dynamic
if exist "publish\" (
    echo  [INFO] Removendo publish anterior para recompilar v3.0...
    rmdir /s /q "publish"
)

echo  [INFO] Restaurando pacotes NuGet (Fleck + Newtonsoft + Microsoft.CSharp)...
dotnet restore ProfitRTDBridge.csproj --verbosity quiet
if %errorlevel% neq 0 (
    echo  [ERRO] Falha ao baixar dependencias. Verifique internet.
    pause & exit /b 1
)
echo  [OK] Dependencias prontas.
echo.

echo  [INFO] Publicando como .exe 32-bit unico (aguarde ~60s)...
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
    echo  [ERRO] Falha ao publicar. Tentando dotnet run...
    goto run_dotnet
)

echo.
echo  [OK] Publicado: %CD%\publish\ProfitRTDBridge.exe
echo.

:run_exe
echo  ====================================================
echo   CHECKLIST - confirme antes de prosseguir:
echo  ====================================================
echo.
echo  [1] Profit Pro esta ABERTO e LOGADO?
echo.
echo  [2] RTD esta HABILITADO no Profit?
echo      Ferramentas ^> Configuracoes ^>
echo      Exportacao em Tempo Real (RTD/DDE) ^> Habilitar
echo      (Reinicie o Profit apos habilitar pela 1a vez)
echo.
echo  [3] Profit e Bridge com MESMO nivel de permissao?
echo      Se Profit esta como Admin, rode este bat como Admin.
echo      Se Profit esta como usuario normal, rode normal.
echo.
echo  Apos confirmar, acesse:
echo  https://opcoesprox.com.br/dados-ao-vivo
echo.
echo  [Pressione qualquer tecla para iniciar o bridge]
pause >nul

"publish\ProfitRTDBridge.exe" --port %PORT%
goto end

:run_dotnet
dotnet run --project ProfitRTDBridge.csproj -c Release -- --port %PORT%

:end
echo.
echo  Bridge encerrado.
pause
