let transactions = [];
let myChart;

fetch("/api/transaction")
  .then(response => {
    return response.json();
  })
  .then(data => {
    // save db data on global variable
    transactions = data;

    populateTotal();
    populateTable();
    populateChart();
  });

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {    
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  })
  .catch(err => {
    // fetch failed, so save in indexed db
    saveRecord(transaction);

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};


let db;

const request = indexedDB.open("budget", 1);

request.onupgradeneeded = function(event) {
  const db = event.target.result;
  db.createObjectStore("transaction", { autoIncrement: true });
};

request.onsuccess = function(event) {
  db = event.target.result;

  // check if app is online before reading from db
  if (navigator.onLine) {
    checkDatabase();
  }
};

request.onerror = function(event) {
  console.log("Error " + event.target.errorCode);
};

function saveRecord(record) {
  const transaction = db.transaction(["transaction"], "readwrite");
  const store = transaction.objectStore("transaction");

  store.add(record);

  // clear form
  $("#nameEl").val("");
  $("#amountEl").val("");
  // $("#guests").val(0);
}

function isOffline(){
  $("#onlineStatus").attr("src", "images/offline_button.png");
}

function checkDatabase() {
  $("#onlineStatus").attr("src", "images/online_button.png");
  
  const transaction = db.transaction(["transaction"], "readwrite");
  const store = transaction.objectStore("transaction");
  const getAll = store.getAll();

  getAll.onsuccess = function() {
    //if there are any documents waiting to be online, bulk push
    if (getAll.result.length > 0) {
    
      $.ajax({
        type: "POST",
        url: "/api/transaction/bulk",
        data: JSON.stringify(getAll.result),
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json"
        },
        success: function(msg){
            const transaction = db.transaction(["transaction"], "readwrite");
            const store = transaction.objectStore("transaction");
            store.clear();
            populateTable();
        },
        error: function(XMLHttpRequest, textStatus, errorThrown) {
          console.log(getAll.result);
          console.log("Failed to Save DB");
          console.log(XMLHttpRequest, textStatus, errorThrown)
        }
      });
    }
  };
}

// listen for app coming back online
window.addEventListener("online", checkDatabase);

//Trigger some css when offline
window.addEventListener("offline", isOffline, false);
