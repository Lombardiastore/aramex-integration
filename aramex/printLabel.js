const axios = require('axios');

async function printLabel(shipmentNumber) {
  const payload = {
    ClientInfo: {
      UserName: 'testingapi@aramex.com',
      Password: 'R123456789$r',
      Version: 'v1',
      AccountNumber: '20016',
      AccountPin: '543543',
      AccountEntity: 'AMM',
      AccountCountryCode: 'JO',
      Source: 24
    },
    LabelInfo: {
      ReportID: 9729,
      ReportType: 'URL'
    },
    OriginEntity: 'AMM',
    ProductGroup: 'DOM',
    ShipmentNumber: shipmentNumber,
    Transaction: {
      Reference1: 'TEST_PRINT',
      Reference2: '',
      Reference3: '',
      Reference4: '',
      Reference5: ''
    }
  };

  try {
    const response = await axios.post(
      'https://ws.sbx.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/PrintLabel',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    );

    const labelUrl = response.data.LabelURL || response.data?.ShipmentLabel?.LabelURL;
    console.log('✅ Label URL:', labelUrl);
  } catch (error) {
    console.error('❌ Error printing label:', error.response?.data || error.message);
  }
}

// 👇 حط رقم الشحنة هون وجرب
printLabel('44164454014');
