var web3 = null;
var userAccount = null;
var Token = null;

const LAUNCHMINT_FEE_RECEIVER = "0x5a8E77b402ee10286436592ea5a523a40fC410f7";

const NETWORK_FEES = {
    1: "0.01", 5: "0.005", 11155111: "0.005", 56: "0.2", 97: "0.02",
    137: "30", 80001: "0.1", 43114: "1", 43113: "0.02",
    42161: "0.01", 421613: "0.005", 10: "0.01", 420: "0.005",
    8453: "0.01", 84531: "0.005"
};

const networkNames = {
    1: "Ethereum Mainnet", 5: "Goerli Testnet", 11155111: "Sepolia Testnet",
    56: "Binance Smart Chain", 97: "BSC Testnet", 137: "Polygon (Matic)",
    80001: "Polygon Mumbai", 43114: "Avalanche C-Chain", 43113: "Avalanche Fuji",
    42161: "Arbitrum One", 421613: "Arbitrum Goerli", 10: "Optimism",
    420: "Optimism Goerli", 8453: "Base Mainnet", 84531: "Base Goerli"
};

const networkSymbols = {
    1: "ETH", 5: "ETH", 11155111: "ETH", 56: "BNB", 97: "BNB",
    137: "MATIC", 80001: "MATIC", 43114: "AVAX", 43113: "AVAX",
    42161: "ETH", 421613: "ETH", 10: "ETH", 420: "ETH",
    8453: "ETH", 84531: "ETH"
};

// ---- MetaMask Connect ----

async function connectWallet() {
    if (!window.ethereum) {
        return Swal.fire("No MetaMask", "Please install MetaMask!", "error");
    }

    try {
        web3 = new Web3(window.ethereum);
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAccount = (await web3.eth.getAccounts())[0];

        document.getElementById('evm-section').style.visibility = 'visible';
        await updateUIConnected();

        const btn = document.getElementById('connect-evm-btn');
        btn.textContent = "Disconnect MetaMask";
        btn.style.backgroundColor = "#FF4B4B";

        window.ethereum.on('chainChanged', handleChainChanged);
        window.ethereum.on('accountsChanged', handleAccountsChanged);

    } catch (err) {
        console.error("MetaMask Connect Error", err);
        Swal.fire("MetaMask Error", "Connection failed.", "error");
    }
}

function disconnectWallet() {
    web3 = null;
    userAccount = null;

    updateUIDisconnected();

    document.getElementById('evm-section').style.visibility = 'hidden';

    const btn = document.getElementById('connect-evm-btn');
    btn.textContent = "Connect MetaMask";
    btn.style.backgroundColor = "#3EB489";

    if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
}

const handleChainChanged = async () => {
    if (web3 && userAccount) {
        userAccount = (await web3.eth.getAccounts())[0];
        await updateUIConnected();
    }
};

const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
        disconnectWallet();
    } else {
        userAccount = accounts[0];
        await updateUIConnected();
    }
};

// ---- UI Helpers ----

const shortenAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

async function updateUIConnected() {
    const chainId = await web3.eth.getChainId();
    const symbol = networkSymbols[chainId] || '';
    const balance = await web3.eth.getBalance(userAccount);
    const fee = NETWORK_FEES[chainId];

    document.getElementById('wallet-address').textContent = `👛 Wallet: ${shortenAddress(userAccount)}`;
    document.getElementById('connect-evm-btn').textContent = "Disconnect";
    document.getElementById('connect-evm-btn').style.backgroundColor = "#FF4B4B";
    document.getElementById('create-token-btn').disabled = false;
    document.getElementById('network-status').textContent = `🛡️ Connected to: ${networkNames[chainId] || chainId}`;
    document.getElementById('balance-status').textContent = `💰 Balance: ${parseFloat(web3.utils.fromWei(balance, 'ether')).toFixed(4)} ${symbol}`;
    document.getElementById('launchmint-fee-status').textContent = fee ? `🎟️ LaunchMint Fee: ${fee} ${symbol}` : `🎟️ Fee: Not supported`;

    fetchGasPrice();
}

function updateUIDisconnected() {
    document.getElementById('wallet-address').textContent = '👛 Wallet: Not connected';
    document.getElementById('network-status').textContent = '🛡️ Network: Not connected';
    document.getElementById('balance-status').textContent = '💰 Balance: 0';
    document.getElementById('gas-status').textContent = '⛽ Gas Price: Loading...';
    document.getElementById('connect-evm-btn').textContent = "Connect MetaMask";
    document.getElementById('connect-evm-btn').style.backgroundColor = "#3EB489";
    document.getElementById('create-token-btn').disabled = true;
}

async function fetchGasPrice() {
    try {
        const gasPrice = await web3.eth.getGasPrice();
        const gwei = web3.utils.fromWei(gasPrice, 'gwei');
        const speed = gwei > 70 ? "🔴 High" : gwei > 30 ? "🟡 Medium" : "🟢 Low";
        document.getElementById('gas-status').textContent = `⛽ Gas Price: ${parseFloat(gwei).toFixed(1)} Gwei (${speed})`;
        setTimeout(fetchGasPrice, 10000);
    } catch (err) {
        console.error("Gas fetch failed", err);
    }
}

// ---- EVM Token Deployment ----

async function createToken(name, symbol, decimals, supply) {
    const chainId = await web3.eth.getChainId();
    const fee = NETWORK_FEES[chainId];

    if (!fee) return Swal.fire("Unsupported Network", "This network is not supported.", "error");

    const balance = await web3.eth.getBalance(userAccount);
    if (web3.utils.toBN(balance).lt(web3.utils.toBN(web3.utils.toWei(fee, 'ether')))) {
        return Swal.fire("Low Balance", `Need at least ${fee} ${networkSymbols[chainId]}`, "error");
    }

    // Validate max supply
    const maxSupply = 4000000000000000;
    if (parseFloat(supply) > maxSupply) {
        return Swal.fire("🚫 Limit Exceeded", "Maximum allowed supply is 4,000,000,000,000,000 tokens.", "warning");
    }

    if (!Token) {
        try {
            Token = await (await fetch('/static/Token.json')).json();
        } catch {
            return Swal.fire("Load Failed", "Unable to fetch contract.", "error");
        }
    }

    const contract = new web3.eth.Contract(Token.abi);
    const deployTx = contract.deploy({ data: Token.bytecode, arguments: [name, symbol, decimals, supply] });

    try {
        await web3.eth.sendTransaction({ from: userAccount, to: LAUNCHMINT_FEE_RECEIVER, value: web3.utils.toWei(fee, 'ether') });

        Swal.fire({ title: "Deploying Token...", text: "Confirm in MetaMask", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const gas = await deployTx.estimateGas({ from: userAccount });
        const gasPrice = await web3.eth.getGasPrice();
        const deployed = await deployTx.send({ from: userAccount, gas, gasPrice });

        Swal.fire({
            icon: 'success',
            title: 'Token Deployed!',
            html: `🎉 Contract:<br><b>${deployed.options.address}</b>`,
            confirmButtonText: 'View'
        }).then((res) => {
            if (res.isConfirmed) {
                window.location.href = `/success?address=${deployed.options.address}&chain=${chainId}`;
            }
        });
    } catch (err) {
        Swal.fire("Deployment Failed", "Token creation failed.", "error");
    }
}

// ---- DOM Events ----

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("evm-section").style.visibility = "visible";
    document.getElementById("connect-evm-btn").textContent = "Connect MetaMask";
    document.getElementById("connect-evm-btn").style.backgroundColor = "#3EB489";

    const evmBtn = document.getElementById("connect-evm-btn");

    evmBtn?.addEventListener("click", async () => {
        if (!web3 || !userAccount) {
            const connected = await connectWallet();
            if (connected !== false) {
                document.getElementById("evm-section").style.visibility = "visible";
                window.scrollTo(0, 0);
                evmBtn.textContent = "Disconnect MetaMask";
                evmBtn.style.backgroundColor = "#FF4B4B";
            }
        } else {
            disconnectWallet();
            document.getElementById("evm-section").style.visibility = "visible";
            evmBtn.textContent = "Connect MetaMask";
            evmBtn.style.backgroundColor = "#3EB489";
        }
    });

    document.getElementById("create-token-btn")?.addEventListener("click", async () => {
        const name = document.getElementById("tokenName").value;
        const symbol = document.getElementById("tokenSymbol").value;
        const supply = document.getElementById("totalSupply").value;
        const decimals = document.getElementById("decimals").value;

        if (!name || !symbol || !supply || !decimals) {
            return Swal.fire("Missing Fields", "Please fill in all fields.", "warning");
        }

        await createToken(name, symbol, decimals, supply);
    });
});
