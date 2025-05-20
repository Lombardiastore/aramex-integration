const axios = require('axios');

const payload = {
  ClientInfo: {
    UserName: "testingapi@aramex.com",
    Password: "R123456789$r",
    Version: "v1",
    AccountNumber: "20016",
    AccountPin: "543543",
    AccountEntity: "AMM",
    AccountCountryCode: "JO",
    Source: 24
  },
  GetLastTrackingUpdateOnly: false,
  Shipments: ["44164454014"], // ✳️ غير هذا الرقم لرقم شحنتك اللي طلع معك من الخطوة الأولى
  Transaction: {
    Reference1: "TEST123",
    Reference2: "",
    Reference3: "",
    Reference4: "",
    Reference5: ""
  }
};

axios.post(
  "https://ws.sbx.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments",
  payload,
  {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    }
  }
)
.then(response => {
  console.log("✅ Tracking Result:");
  console.dir(response.data, { depth: null });
})
.catch(error => {
  console.error("❌ Tracking Error:");
  console.error(error.response?.data || error.message);
});

