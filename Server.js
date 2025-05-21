require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// 🕒 تحويل التاريخ إلى صيغة /Date(...)/
function toAramexDate(date) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const hours = pad(offset / 60);
  const minutes = pad(offset % 60);
  return `/Date(${date.getTime()}${sign}${hours}${minutes})/`;
}

// 🟢 تسجيل ومراقبة الطلبات للمنع التكرار
const processedOrders = new Set();
function isOrderProcessed(orderId) {
  return processedOrders.has(orderId);
}
function markOrderAsProcessed(orderId) {
  processedOrders.add(orderId);
}

app.post('/webhook', async (req, res) => {
  console.log('🔔 Webhook received from Shopify!');
  console.log('📦 FULL Webhook Payload:', JSON.stringify(req.body, null, 2));

  const orderId = req.body.id;
  if (isOrderProcessed(orderId)) {
    console.log('⚠️ Order already processed. Skipping.');
    return res.status(200).send('Already processed');
  }

  const payload = {
    ClientInfo: {
      UserName: "testingapi@aramex.com",
      Password: "R123456789$r",
      Version: "v1",
      AccountNumber: "20016",
      AccountPin: "331421",
      AccountEntity: "AMM",
      AccountCountryCode: "JO",
      Source: 24
    },
    Shipments: [
      {
        Reference1: orderId.toString(),
        Reference2: "",
        Reference3: "",
        Shipper: {
          Reference1: orderId.toString(),
          Reference2: "",
          AccountNumber: "20016",
          PartyAddress: {
            Line1: "Shpr Address Line 1",
            Line2: "",
            Line3: "",
            City: "AMMAN",
            StateOrProvinceCode: "",
            PostCode: "",
            CountryCode: "JO",
            Longitude: 0,
            Latitude: 0,
            BuildingNumber: null,
            BuildingName: null,
            Floor: null,
            Apartment: null,
            POBox: null,
            Description: null
          },
          Contact: {
            Department: "",
            PersonName: "Shpr Person Name",
            Title: "",
            CompanyName: "Shpr Company Name",
            PhoneNumber1: "962790000000",
            PhoneNumber1Ext: "",
            PhoneNumber2: "",
            PhoneNumber2Ext: "",
            FaxNumber: "",
            CellPhone: "962790000000",
            EmailAddress: "shpr@emailadress.com",
            Type: ""
          }
        },
        Consignee: {
          Reference1: orderId.toString(),
          Reference2: "",
          AccountNumber: "",
          PartyAddress: {
            Line1: "Cnee Address Line 1",
            Line2: "",
            Line3: "",
            City: "AMMAN",
            StateOrProvinceCode: "",
            PostCode: "",
            CountryCode: "JO",
            Longitude: 0,
            Latitude: 0,
            BuildingNumber: "",
            BuildingName: "",
            Floor: "",
            Apartment: "",
            POBox: null,
            Description: ""
          },
          Contact: {
            Department: "",
            PersonName: "Cnee Person Name",
            Title: "",
            CompanyName: "Cnee Company Name",
            PhoneNumber1: "962790000001",
            PhoneNumber1Ext: "",
            PhoneNumber2: "",
            PhoneNumber2Ext: "",
            FaxNumber: "",
            CellPhone: "962790000001",
            EmailAddress: "cnee@emailadress.com",
            Type: ""
          }
        },
        ThirdParty: {
          Reference1: orderId.toString(),
          Reference2: "",
          AccountNumber: "",
          PartyAddress: {
            Line1: "",
            Line2: "",
            Line3: "",
            City: "",
            StateOrProvinceCode: "",
            PostCode: "",
            CountryCode: "",
            Longitude: 0,
            Latitude: 0,
            BuildingNumber: null,
            BuildingName: null,
            Floor: null,
            Apartment: null,
            POBox: null,
            Description: null
          },
          Contact: {
            Department: "",
            PersonName: "",
            Title: "",
            CompanyName: "",
            PhoneNumber1: "",
            PhoneNumber1Ext: "",
            PhoneNumber2: "",
            PhoneNumber2Ext: "",
            FaxNumber: "",
            CellPhone: "",
            EmailAddress: "",
            Type: ""
          }
        },
        ShippingDateTime: toAramexDate(new Date()),
        DueDate: toAramexDate(new Date()),
        Comments: "",
        PickupLocation: "",
        OperationsInstructions: "",
        AccountingInstrcutions: "",
        Details: {
          Dimensions: {
            Length: 10,
            Width: 10,
            Height: 10,
            Unit: "CM"
          },
          ActualWeight: {
            Unit: "KG",
            Value: 0.5
          },
          ChargeableWeight: {
            Unit: "KG",
            Value: 0.5
          },
          DescriptionOfGoods: "Test order",
          GoodsOriginCountry: "JO",
          NumberOfPieces: 1,
          ProductGroup: "DOM",
          ProductType: "ONP",
          PaymentType: "P",
          PaymentOptions: "",
          CustomsValueAmount: {
            CurrencyCode: "JOD",
            Value: 0
          },
          CashOnDeliveryAmount: {
            CurrencyCode: "JOD",
            Value: 0
          },
          InsuranceAmount: null,
          CashAdditionalAmount: null,
          CashAdditionalAmountDescription: "",
          CollectAmount: null,
          Services: "",
          Items: {
            Comments: "",
            GoodsDescription: "",
            CountryOfOrigin: "",
            Reference: "",
            CommodityCode: ""
          }
        },
        Attachments: [],
        ForeignHAWB: "",
        TransportType: 0,
        PickupGUID: "",
        Number: null,
        ScheduledDelivery: null
      }
    ],
    LabelInfo: {
      ReportID: 9729,
      ReportType: "URL"
    },
    Transaction: {
      Reference1: orderId.toString(),
      Reference2: "",
      Reference3: "",
      Reference4: "",
      Reference5: ""
    }
  };

  try {
    const createShipmentRes = await axios.post(
      'https://ws.sbx.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    console.log('✅ Aramex CreateShipment Response:', createShipmentRes.data);

    const shipmentID = createShipmentRes.data?.Shipments?.[0]?.ID;
    if (!shipmentID) return res.status(400).send('Shipment creation failed');

    markOrderAsProcessed(orderId);

    res.status(200).send('Success');
  } catch (error) {
    console.error('❌ Aramex Error:', error.response?.data || error.message);
    res.status(500).send('Failed');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
