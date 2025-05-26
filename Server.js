require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
  const topic = req.headers['x-shopify-topic'];
  const order = req.body;
  const orderId = order.id;
  console.log(`🔔 Webhook received: ${topic} for Order ID: ${orderId}`);

  if (topic === 'orders/cancelled') {
    try {
      const pickupRefs = JSON.parse(fs.readFileSync('pickup_references.json', 'utf8'));
      const pickupGUID = pickupRefs[orderId];
      if (pickupGUID) {
        const cancelPayload = {
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
          PickupGUID: pickupGUID,
          Transaction: {
            Reference1: orderId.toString()
          }
        };

        const cancelRes = await axios.post(
          'https://ws.sbx.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CancelPickup',
          cancelPayload,
          { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
        );
        console.log('🚫 Pickup Cancelled:', cancelRes.data);
      }
      return res.status(200).send('Cancelled handled');
    } catch (err) {
      console.error('❌ Cancel Error:', err.response?.data || err.message);
      return res.status(500).send('Cancel failed');
    }
  }

  if (isOrderProcessed(orderId)) {
    console.log('⚠️ Order already processed. Skipping.');
    return res.status(200).send('Already processed');
  }

  let locationId = order.location_id || order.line_items?.[0]?.origin_location?.id;
  async function getLocationById(locationId) {
    const shop = 'lombardiastore.com';
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    try {
      const res = await axios.get(
        `https://${shop}/admin/api/2024-01/locations/${locationId}.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
      );
      return res.data.location;
    } catch (err) {
      console.error('❌ Error fetching location:', err.response?.data || err.message);
      return null;
    }
  }

  const locationInfo = locationId ? await getLocationById(locationId) : null;
  const isCOD = order.payment_gateway_names.some(g => g.toLowerCase().includes("cod") || g.toLowerCase().includes("cash"));
  const codAmount = isCOD ? parseFloat(order.total_price) : 0;
  const totalWeight = order.line_items.reduce((sum, item) => {
  const weightInKg = item.grams ? item.grams / 1000 : (item.weight || 0);
  return sum + weightInKg * item.quantity;
}, 0);
  function getNextWorkingDay(date = new Date()) {
  let local = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Amman" }));
  while ([5, 6].includes(local.getDay())) {
    local.setDate(local.getDate() + 1);
  }
  return local;
}

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
          Line1: locationInfo?.address1 || "Okkia Booth",
          Line2: locationInfo?.address2 || "",
          Line3: "",
          City: locationInfo?.city || "Amman",
          PostCode: locationInfo?.zip || "",
          CountryCode: locationInfo?.country_code || "JO",
          Longitude: 0,
         Latitude: 0
        },
         Contact: {
  PersonName: locationInfo?.name || "Default Name",
  CompanyName: locationInfo?.name || "Default Name",
  PhoneNumber1: locationInfo?.phone || "962790000000",
  PhoneNumber2: "", // ✅ مضاف
  PhoneNumber1Ext: "",
  PhoneNumber2Ext: "",
  FaxNumber: "",
  CellPhone: locationInfo?.phone || "962790000000",
  EmailAddress: "info@lombardiastore.com",
  Type: "" // ✅ مضاف
}

        },
         Consignee: {
          Reference1: orderId.toString(),
          Reference2: "",
          AccountNumber: "",
          AccountEntity: "",
          PartyAddress: {
          Line1: order.shipping_address?.address1 || "",
          Line2: order.shipping_address?.address2 || "",
          Line3: "",
          City: order.shipping_address?.city || "",
          StateOrProvinceCode: order.shipping_address?.province_code || "",
          PostCode: order.shipping_address?.zip || "",
          CountryCode: order.shipping_address?.country_code || "JO",
          Longitude: 0,
          Latitude: 0
         },
        Contact: {
          PersonName: `${order.shipping_address?.first_name || ""} ${order.shipping_address?.last_name || ""}`,
          CompanyName: order.shipping_address?.company || "",
          PhoneNumber1: (order.shipping_address?.phone || '').replace('+962', '0'),
          PhoneNumber2: "",
          PhoneNumber1Ext: "",
          PhoneNumber2Ext: "",
          FaxNumber: "",
          CellPhone: order.shipping_address?.phone || "",
          EmailAddress: order.email || "",
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
  Value: totalWeight
},
ChargeableWeight: {
  Unit: "KG",
  Value: totalWeight
},

          DescriptionOfGoods: order.line_items?.map(i => i.title).join(', ') || "Order Items",
          GoodsOriginCountry: "JO",
          NumberOfPieces: order.line_items.reduce((sum, item) => sum + item.quantity, 0),
          ProductGroup: "DOM",
          ProductType: "ONP",
          PaymentType: isCOD ? "C" : "P",
          PaymentOptions: "",
          CashOnDeliveryAmount: {
          CurrencyCode: "JOD",
          Value: isCOD ? codAmount : 0
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
    console.log('📤 Payload to Aramex (CreateShipments):', JSON.stringify(payload, null, 2)); // temporary
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
    console.log('🚨 Aramex Error Notifications:', JSON.stringify(createShipmentRes.data?.Shipments?.[0]?.Notifications, null, 2));
    if (!shipmentID) return res.status(400).send('Shipment creation failed');
// 🟢 حفظ رقم الشحنة في ملف shipments.json


const SHIPMENTS_DATA_FILE = path.join(__dirname, 'shipments.json');
let shipmentRefs = {};
if (fs.existsSync(SHIPMENTS_DATA_FILE)) {
  shipmentRefs = JSON.parse(fs.readFileSync(SHIPMENTS_DATA_FILE));
}
if (!shipmentID || shipmentRefs[orderId]) {
  console.log(`⚠️ Shipment skipped for Order ${orderId}. Already exists or Aramex failed.`);
  return res.status(200).send('Shipment already exists or failed');
}

shipmentRefs[orderId] = shipmentID;
fs.writeFileSync(SHIPMENTS_DATA_FILE, JSON.stringify(shipmentRefs, null, 2));
console.log(`💾 Saved Shipment ID for order ${orderId}`);

const labelPayload = {
  ClientInfo: payload.ClientInfo,
  LabelInfo: payload.LabelInfo,
  OriginEntity: "AMM",
  ProductGroup: "DOM",
  ShipmentNumber: shipmentID,
  Transaction: payload.Transaction
};

const labelRes = await axios.post(
  'https://ws.sbx.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/PrintLabel',
  labelPayload,
  {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }
);

const labelUrl = labelRes.data.LabelURL || labelRes.data?.ShipmentLabel?.LabelURL;
console.log('✅ Label URL:', labelUrl);
const pickupPayload = {
  ClientInfo: payload.ClientInfo,
  LabelInfo: { ReportID: 9201, ReportType: "URL" },
  Pickup: {
    PickupAddress: payload.Shipments[0].Shipper.PartyAddress,
    PickupContact: payload.Shipments[0].Shipper.Contact,
    PickupLocation: "Reception",
    PickupDate: toAramexDate(getNextWorkingDay()),
    ReadyTime: toAramexDate(getNextWorkingDay()),
    LastPickupTime: toAramexDate(getNextWorkingDay()),
    ClosingTime: toAramexDate(getNextWorkingDay()),
    Comments: "",
    Reference1: "Ref1",
    Reference2: "",
    Vehicle: "",
    Shipments: [],
    PickupItems: [
      {
        ProductGroup: "DOM",
        ProductType: "ONP",
        NumberOfShipments: 1,
        PackageType: "",
        Payment: "P",
        ShipmentWeight: { Unit: "KG", Value: 0.5 },
        ShipmentVolume: null,
        NumberOfPieces: 1,
        ShipmentDimensions: { Length: 0, Width: 0, Height: 0, Unit: "" },
        CashAmount: null,
        ExtraCharges: null,
        Comments: ""
      }
    ],
    Status: "Ready",
    ExistingShipments: null,
    Branch: "",
    RouteCode: ""
  },
  Transaction: payload.Transaction
};

const pickupRes = await axios.post(
  'https://ws.sbx.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreatePickup',
  pickupPayload,
  {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }
);

console.log('✅ Pickup created successfully:', pickupRes.data);

// 🟢 حفظ GUID
const CANCELED_DATA_FILE = path.join(__dirname, 'pickup_references.json');
let pickupRefs = {};
if (fs.existsSync(CANCELED_DATA_FILE)) {
  pickupRefs = JSON.parse(fs.readFileSync(CANCELED_DATA_FILE));
}
if (pickupRes.data?.ProcessedPickup?.GUID) {
  pickupRefs[orderId] = pickupRes.data.ProcessedPickup.GUID;
  fs.writeFileSync(CANCELED_DATA_FILE, JSON.stringify(pickupRefs, null, 2));
  console.log(`💾 Saved Pickup GUID for order ${orderId}`);
}

const shop = 'lombardiastore.com';
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
const trackingUrl = `https://www.sxb.aramex.com/track/results?mode=0&ShipmentNumber=${shipmentID}`;
const fulfillmentPayload = {
  fulfillment: {
    tracking_number: shipmentID,
    tracking_urls: [trackingUrl],
    notify_customer: true
  }
};

await axios.post(
  `https://${shop}/admin/api/2024-01/orders/${orderId}/fulfillments.json`,
  fulfillmentPayload,
  {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  }
);

console.log('✅ Shopify order fulfilled with tracking number:', shipmentID);


        markOrderAsProcessed(orderId);
    res.status(200).send('Success');
  } catch (error) {
    console.error('❌ Aramex Error:', error.response?.data || error.message);
    res.status(500).send('Failed');
  }
});


  app.get('/track/:orderId', (req, res) => {
  const orderId = req.params.orderId;
  const shipmentData = JSON.parse(fs.readFileSync('shipments.json', 'utf8'));
  const shipmentID = shipmentData[orderId];
  if (!shipmentID) return res.status(404).send('No shipment found');
  res.redirect(`https://www.sbx.aramex.com/track/results?mode=0&ShipmentNumber=${shipmentID}`);
});


app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});