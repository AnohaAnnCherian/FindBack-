// FindBack — Frontend JavaScript
// Uses the existing Sepolia deployment. Do not redeploy the contract.

const CONTRACT_ADDRESS = "0xf9520B003Cf35132B15914D9620beC85A2F38CB9";
const SEPOLIA_CHAIN_ID = 11155111n;

const CONTRACT_ABI = [
  "function itemCount() view returns (uint256)",
  "function reportItem(string name, string description, bool isFound, bytes32 claimHash)",
  "function claimItem(uint256 itemId, bytes32 claimHash)",
  "function markReturned(uint256 itemId)",
  "function getItem(uint256 itemId) view returns (uint256 id, address reporter, string name, string description, bool isFound, address claimant, uint8 status, uint256 reportedAt)"
];

let provider;
let signer;
let writeContract;
let readContract;
let connectedAccount = null;

const connectButton = document.getElementById("connectWallet");
const walletButtonText = document.getElementById("walletButtonText");
const networkStatus = document.getElementById("networkStatus");
const totalItems = document.getElementById("totalItems");
const itemsList = document.getElementById("itemsList");
const messageBox = document.getElementById("message");

function showMessage(message, type = "success") {
  messageBox.textContent = message;
  messageBox.className = `message-box show ${type}`;
}

function clearMessage() {
  messageBox.textContent = "";
  messageBox.className = "message-box";
}

function shortAddress(address) {
  if (!address) return "Not available";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getStatus(status) {
  const value = Number(status);

  if (value === 0) {
    return {
      label: "Available",
      className: "status-available"
    };
  }

  if (value === 1) {
    return {
      label: "Claimed",
      className: "status-claimed"
    };
  }

  if (value === 2) {
    return {
      label: "Returned",
      className: "status-returned"
    };
  }

  return {
    label: "Unknown",
    className: "status-returned"
  };
}

// Image filenames must match the files placed inside the images folder.
function getItemImage(name) {
  const value = String(name || "").toLowerCase();

  if (value.includes("headphone") || value.includes("earbud")) {
    return "images/headphones.jpg";
  }

  if (value.includes("phone") || value.includes("mobile")) {
    return "images/mobile.jpg";
  }

  if (value.includes("wallet") || value.includes("purse")) {
    return "images/wallet.jpg";
  }

  if (value.includes("key")) {
    return "images/keys.jpg";
  }

  if (value.includes("bag") || value.includes("backpack")) {
    return "images/backpack.jpg";
  }

  if (value.includes("book")) {
    return "images/book.jpg";
  }

  if (value.includes("watch")) {
    return "images/watch.jpg";
  }

  if (value.includes("laptop")) {
    return "images/laptop.jpg";
  }

  if (value.includes("card") || value.includes("id")) {
    return "images/id-card.jpg";
  }

  return "images/default.svg";
}

// Creates an item card using information read from the blockchain.
function createItemCard(item) {
  const card = document.createElement("article");
  card.className = "item-card";

  // Item photograph
  const imageWrap = document.createElement("div");
  imageWrap.className = "item-photo-wrap";

  const image = document.createElement("img");
  image.className = "item-photo";
  image.src = getItemImage(item.name);
  image.alt = `${item.name || "Reported item"} photograph`;
  image.loading = "lazy";

  image.onerror = () => {
    image.onerror = null;
    image.src = "images/default.svg";
  };

  imageWrap.appendChild(image);

  // Status badge
  const top = document.createElement("div");
  top.className = "item-card-top";

  const status = getStatus(item.status);

  const statusBadge = document.createElement("span");
  statusBadge.className = `status-badge ${status.className}`;
  statusBadge.textContent = status.label;

  top.appendChild(statusBadge);

  // Item name
  const title = document.createElement("h3");
  title.textContent = item.name || "Unnamed item";

  // Item description
  const description = document.createElement("p");
  description.className = "item-description";
  description.textContent =
    item.description || "No description provided.";

  // Lost or found type
  const type = document.createElement("p");
  type.className = "item-description";
  type.textContent = item.isFound ? "Found item" : "Lost item";

  // Item metadata
  const meta = document.createElement("div");
  meta.className = "item-meta";

  const id = document.createElement("span");
  id.className = "item-id";
  id.textContent = `ITEM #${item.id}`;

  const reporter = document.createElement("span");
  reporter.className = "item-reporter";
  reporter.textContent = `By ${shortAddress(item.reporter)}`;

  meta.append(id, reporter);

  card.append(
    imageWrap,
    top,
    title,
    description,
    type,
    meta
  );

  return card;
}

// Connect MetaMask wallet.
async function connectWallet() {
  clearMessage();

  if (!window.ethereum) {
    showMessage(
      "MetaMask was not detected. Please install or enable the MetaMask browser extension.",
      "error"
    );
    return;
  }

  try {
    await window.ethereum.request({
      method: "eth_requestAccounts"
    });

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    const network = await provider.getNetwork();

    if (network.chainId !== SEPOLIA_CHAIN_ID) {
      networkStatus.innerHTML =
        '<span class="network-dot"></span> Please switch to Sepolia';

      showMessage(
        "Please select the Sepolia test network in MetaMask, then connect again.",
        "error"
      );

      return;
    }

    connectedAccount = await signer.getAddress();

    writeContract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      signer
    );

    readContract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider
    );

    walletButtonText.textContent = shortAddress(connectedAccount);

    networkStatus.innerHTML =
      '<span class="network-dot" style="background:#76a47c"></span> Connected · Sepolia';

    showMessage(
      `Wallet connected: ${shortAddress(connectedAccount)}. You are connected to Sepolia.`
    );

    await loadItems();

  } catch (error) {
    console.error(error);

    showMessage(
      error.shortMessage ||
      error.message ||
      "Could not connect to MetaMask.",
      "error"
    );
  }
}

// Read and display items from the smart contract.
async function loadItems() {
  if (!readContract) {
    itemsList.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent =
      "Connect your MetaMask wallet to load blockchain records.";

    itemsList.appendChild(empty);
    return;
  }

  try {
    itemsList.replaceChildren();

    const count = await readContract.itemCount();

    totalItems.textContent = count.toString();

    if (count === 0n) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent =
        "No items have been reported yet. Be the first to add one!";

      itemsList.appendChild(empty);
      return;
    }

    for (let id = 1n; id <= count; id++) {
      const result = await readContract.getItem(id);

      const item = {
        id: result.id,
        reporter: result.reporter,
        name: result.name,
        description: result.description,
        isFound: result.isFound,
        claimant: result.claimant,
        status: result.status,
        reportedAt: result.reportedAt
      };

      itemsList.appendChild(createItemCard(item));
    }

  } catch (error) {
    console.error("Loading items failed:", error);

    itemsList.replaceChildren();

    const errorCard = document.createElement("div");
    errorCard.className = "empty-state";
    errorCard.textContent =
      "Could not load items. Please check the contract ABI and your Sepolia connection.";

    itemsList.appendChild(errorCard);

    showMessage(
      error.shortMessage ||
      error.message ||
      "Could not load blockchain items.",
      "error"
    );
  }
}

// Check wallet connection and network before transactions.
async function waitForWallet() {
  if (!window.ethereum || !writeContract) {
    throw new Error(
      "Please connect your MetaMask wallet first."
    );
  }

  const network = await provider.getNetwork();

  if (network.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      "Please switch MetaMask to the Sepolia network."
    );
  }
}

// Report a lost or found item.
async function handleReport(event) {
  event.preventDefault();
  clearMessage();

  const submitButton = event.submitter;

  const name = document
    .getElementById("itemName")
    .value
    .trim();

  const description = document
    .getElementById("itemDescription")
    .value
    .trim();

  // The HTML select uses the words Lost and Found.
  const isFound =
    document.getElementById("itemType").value === "Found";

  const secretCode =
    document.getElementById("secretCode").value;

  if (secretCode.length < 12) {
    showMessage(
      "Please create a private claim code with at least 12 characters.",
      "error"
    );
    return;
  }

  try {
    await waitForWallet();

    submitButton.disabled = true;
    submitButton.textContent = "Waiting for MetaMask...";

    // Convert the secret code into a Keccak-256 hash.
    const claimHash = ethers.keccak256(
      ethers.toUtf8Bytes(secretCode)
    );

    const transaction = await writeContract.reportItem(
      name,
      description,
      isFound,
      claimHash
    );

    showMessage(
      "Transaction submitted. Waiting for blockchain confirmation..."
    );

    await transaction.wait();

    document.getElementById("reportForm").reset();

    showMessage(
      "Your item record has been published successfully!"
    );

    await loadItems();

  } catch (error) {
    console.error(error);

    showMessage(
      error.shortMessage ||
      error.reason ||
      error.message ||
      "Could not report the item.",
      "error"
    );

  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML =
      'Submit report <span>↗</span>';
  }
}

// Submit a claim for an item.
async function handleClaim(event) {
  event.preventDefault();
  clearMessage();

  const submitButton = event.submitter;

  const itemId =
    document.getElementById("claimItemId").value;

  const secretCode =
    document.getElementById("claimSecretCode").value;

  if (!itemId || Number(itemId) < 1 || !secretCode) {
    showMessage(
      "Please enter a valid item ID and claim code.",
      "error"
    );
    return;
  }

  try {
    await waitForWallet();

    submitButton.disabled = true;
    submitButton.textContent = "Waiting for MetaMask...";

    // Hash the entered code in the same way as the report function.
    const claimHash = ethers.keccak256(
      ethers.toUtf8Bytes(secretCode)
    );

    const transaction = await writeContract.claimItem(
      BigInt(itemId),
      claimHash
    );

    showMessage(
      "Claim transaction submitted. Waiting for confirmation..."
    );

    await transaction.wait();

    document.getElementById("claimForm").reset();

    showMessage(
      "Claim submitted successfully! The item status has been updated."
    );

    await loadItems();

  } catch (error) {
    console.error(error);

    showMessage(
      error.shortMessage ||
      error.reason ||
      error.message ||
      "Could not submit the claim.",
      "error"
    );

  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML =
      'Submit claim <span>↗</span>';
  }
}

// Mark an item as returned.
async function handleReturn(event) {
  event.preventDefault();
  clearMessage();

  const submitButton = event.submitter;

  const itemId =
    document.getElementById("returnItemId").value;

  if (!itemId || Number(itemId) < 1) {
    showMessage(
      "Please enter a valid item ID.",
      "error"
    );
    return;
  }

  try {
    await waitForWallet();

    submitButton.disabled = true;
    submitButton.textContent = "Waiting for MetaMask...";

    const transaction = await writeContract.markReturned(
      BigInt(itemId)
    );

    showMessage(
      "Return transaction submitted. Waiting for confirmation..."
    );

    await transaction.wait();

    document.getElementById("returnForm").reset();

    showMessage(
      "The item has been marked as returned successfully!"
    );

    await loadItems();

  } catch (error) {
    console.error(error);

    showMessage(
      error.shortMessage ||
      error.reason ||
      error.message ||
      "Could not mark the item as returned.",
      "error"
    );

  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML =
      'Mark as returned <span>✓</span>';
  }
}

// Button and form event listeners.
connectButton.addEventListener(
  "click",
  connectWallet
);

document
  .getElementById("refreshItems")
  .addEventListener("click", loadItems);

document
  .getElementById("reportForm")
  .addEventListener("submit", handleReport);

document
  .getElementById("claimForm")
  .addEventListener("submit", handleClaim);

document
  .getElementById("returnForm")
  .addEventListener("submit", handleReturn);

// Reload the page if the MetaMask account or network changes.
if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => {
    window.location.reload();
  });

  window.ethereum.on("chainChanged", () => {
    window.location.reload();
  });
}

// Load blockchain items when the page opens.
loadItems();