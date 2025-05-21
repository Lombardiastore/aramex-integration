require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CANCELED_DATA_FILE = path.join(__dirname, 'pickup_references.json');
let pickupRefs = {};
if (fs.existsSync(CANCELED_DATA_FILE)) {
  pickupRefs = JSON.parse(fs.readFileSync(CANCELED_DATA_FILE));
}

const SHIPMENTS_DATA_FILE = path.join(__dirname, 'shipments.json');
let shipmentRefs = {};
if (fs.existsSync(SHIPMENTS_DATA_FILE)) {
  shipmentRefs = JSON.parse(fs.readFileSync(SHIPMENTS_DATA_FILE));
}


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

async function getLocationById(locationId) {
  const shop = 'lombardiastore.com';
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

  try {
    const res = await axios.get(
      `https://${shop}/admin/api/2024-01/locations/${locationId}.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      }
    );
    return res.data.location;
  } catch (err) {
    console.error('❌ Error fetching location:', err.response?.data || err.message);
    return null;
  }
}


app.post('/webhook', async (req, res) => {
  const order = req.body;
  let locationId = order.location_id;
  if (!locationId && order.line_items?.[0]?.origin_location?.id) {
  locationId = order.line_items[0].origin_location.id;
  };
  const locationInfo = locationId ? await getLocationById(locationId) : null;
  const orderId = order.id;
   const topic = req.headers['x-shopify-topic'] || '';

   console.log('🔍 Webhook topic:', topic);

  if (topic === 'orders/cancelled') {
    console.log(`⚠️ Shopify order ${orderId} was CANCELLED.`);
    const pickupGUID = pickupRefs[orderId];

    if (pickupGUID) {
      const cancelPayload = {
        ClientInfo: {
          UserName: "waleed.khaled@lombardia.com.jo",
          Password: "W712@acom",
          Version: "v1",
          AccountNumber: "71815721",
          AccountPin: "718181",
          AccountEntity: "AMM",
          AccountCountryCode: "JO",
          Source: 24
        },
        Comments: "Cancelled from Shopify",
        PickupGUID: pickupGUID,
        Transaction: {
          Reference1: orderId.toString(),
          Reference2: "",
          Reference3: "",
          Reference4: "",
          Reference5: ""
        }
      };

      try {
        const cancelRes = await axios.post(
          'https://ws.sbx.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CancelPickup',
          cancelPayload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          }
        );

        console.log('✅ Pickup Cancelled:', cancelRes.data);
        return res.status(200).send('Pickup cancelled successfully');
      } catch (err) {
        console.error('❌ Error cancelling pickup:', err.response?.data || err.message);
        return res.status(500).send('Cancel pickup failed');
      }
    } else {
      console.warn(`❗ No GUID found for order ${orderId}`);
      return res.status(200).send('Order cancelled, no pickup found');
    }
  }

  if (topic !== 'orders/create') {
    console.log(`ℹ️ Ignored webhook topic: ${topic}`);
    return res.status(200).send('Ignored');
  }


  console.log('🔔 Webhook received from Shopify!');
  console.log('📦 FULL Webhook Payload:', JSON.stringify(req.body, null, 2));

  // تأكد إنه وسيلة التوصيل هي Aramex فقط
  const shippingMethod = order.shipping_lines?.[0]?.title || '';
  if (!shippingMethod.toLowerCase().includes('aramex')) {
    console.log(`🚫 Skipping order ${orderId} - Shipping method not Aramex (${shippingMethod})`);
    return res.status(200).send('Shipping method not Aramex');
  }

  if (isOrderProcessed(orderId)) {
    console.log('⚠️ Order already processed. Skipping.');
    return res.status(200).send('Already processed');
  }

const shippingAddress = order.shipping_address;


const customerPhone = shippingAddress.phone || '';
const customerEmail = order.email || '';
const customerName =
  (shippingAddress?.name && shippingAddress.name.trim() !== '') ? shippingAddress.name :
  ((shippingAddress?.first_name || '') + ' ' + (shippingAddress?.last_name || '')).trim() ||
  'Lombardia Customer';
console.log('👤 Customer Name:', customerName);

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
         Line1: locationInfo?.address1 || "Default Line1",
         Line2: locationInfo?.address2 || "",
         Line3: "",
         City: locationInfo?.city || "AMMAN",
         StateOrProvinceCode: locationInfo?.province || "",
         PostCode: locationInfo?.zip || "",
         CountryCode: locationInfo?.country_code || "JO",
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
         PersonName: locationInfo?.name || "Default Name",
         Title: "",
         CompanyName: locationInfo?.name || "Default Company",
         PhoneNumber1: locationInfo?.phone || "962790000000",
         PhoneNumber1Ext: "",
         PhoneNumber2: "",
         PhoneNumber2Ext: "",
         FaxNumber: "",
         CellPhone: locationInfo?.phone || "962790000000",
         EmailAddress: "shpr@emailadress.com",
         Type: ""
        }
        },
        Consignee: {
          Reference1: orderId.toString(),
          Reference2: "",
          AccountNumber: "",
          PartyAddress: {
            Line1: shippingAddress.address1 || "Unknown Street",
            Line2: shippingAddress.address2 || "",
            Line3: "",
            City: shippingAddress.city || "Amman",
            StateOrProvinceCode: shippingAddress.province || "",
            PostCode: shippingAddress.zip || "",
            CountryCode: shippingAddress.country_code || "JO",
            Longitude: shippingAddress.longitude || 0,
            Latitude: shippingAddress.latitude || 0,
            BuildingNumber: "",
            BuildingName: "",
            Floor: "",
            Apartment: "",
            POBox: null,
            Description: ""
          },
          Contact: {
            Department: "",
            PersonName: customerName,
            Title: "",
            CompanyName: "",
            PhoneNumber1: customerPhone,
            PhoneNumber1Ext: "",
            PhoneNumber2: "",
            PhoneNumber2Ext: "",
            FaxNumber: "",
            CellPhone: customerPhone,
            EmailAddress: customerEmail,
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
if (createShipmentRes.data.HasErrors || !createShipmentRes.data.Shipments?.[0]?.ID) {
  markOrderAsProcessed(orderId); // حتى لو صار error من أرامكس، نمنع التكرار
  console.error('❌ Aramex CreateShipment response contains errors or missing shipment ID.');
  console.error('🔎 Notifications:', JSON.stringify(createShipmentRes.data.Shipments?.[0]?.Notifications, null, 2));
  return res.status(400).send('❌ CreateShipment failed. Check Aramex response.');
};



    const shipmentID = createShipmentRes.data?.Shipments?.[0]?.ID;
    shipmentRefs[orderId] = shipmentID;
    fs.writeFileSync(SHIPMENTS_DATA_FILE, JSON.stringify(shipmentRefs, null, 2));
    console.log(`💾 Saved Shipment ID for order ${orderId}`);


    if (shipmentID) {
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
          PickupDate: toAramexDate(new Date()),
          ReadyTime: toAramexDate(new Date()),
          LastPickupTime: toAramexDate(new Date()),
          ClosingTime: toAramexDate(new Date()),
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

      if (pickupRes.data?.ProcessedPickup?.GUID) {
      pickupRefs[orderId] = pickupRes.data.ProcessedPickup.GUID;
      fs.writeFileSync(CANCELED_DATA_FILE, JSON.stringify(pickupRefs, null, 2));
      console.log(`💾 Saved Pickup GUID for order ${orderId}`);
}


      console.log('✅ Pickup created successfully:', pickupRes.data);

      const trackPayload = {
        ClientInfo: payload.ClientInfo,
        GetLastTrackingUpdateOnly: false,
        Shipments: [shipmentID],
        Transaction: payload.Transaction
      };

      const trackRes = await axios.post(
        'https://ws.sbx.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments',
        trackPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      console.log('✅ Tracking Info:', JSON.stringify(trackRes.data, null, 2));

      const shop = 'lombardiastore.com';
      const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
      const trackingUrl = `https://www.aramex.com/track/results?mode=0&ShipmentNumber=${shipmentID}`;
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
    }

    res.status(200).send('Success');
  } catch (error) {
    console.error('❌ Aramex Error:', error.response?.data || error.message);
    res.status(500).send('Failed');
  }
});


app.get('/cancel-shipment/:orderId', async (req, res) => {
  const orderId = req.params.orderId;
  const shipmentID = shipmentRefs[orderId];

  if (!shipmentID) {
    return res.status(404).send('❗ Shipment ID not found for this order');
  }

  const cancelPayload = {
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
    ShipmentNumber: shipmentID,
    Transaction: {
      Reference1: orderId.toString(),
      Reference2: "",
      Reference3: "",
      Reference4: "",
      Reference5: ""
    }
  };

  try {
    const cancelRes = await axios.post(
      'https://ws.sbx.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CancelShipment',
      cancelPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    console.log(`🛑 Shipment ${shipmentID} cancelled:`, cancelRes.data);
    res.status(200).json(cancelRes.data);
  } catch (error) {
    console.error('❌ Cancel Shipment Error:', error.response?.data || error.message);
    res.status(500).send('Cancel shipment failed');
  }
});


app.get('/track/:orderId', async (req, res) => {
  const orderId = req.params.orderId;
  const shipmentID = shipmentRefs[orderId];

  if (!shipmentID) {
    return res.status(404).send('❗ Shipment ID not found for this order');
  }

  const trackPayload = {
    ClientInfo: {
      UserName: "waleed.khaled@lombardia.com.jo",
      Password: "W712@acom",
      Version: "v1",
      AccountNumber: "71815721",
      AccountPin: "718181",
      AccountEntity: "AMM",
      AccountCountryCode: "JO",
      Source: 24
    },
    GetLastTrackingUpdateOnly: false,
    Shipments: [shipmentID],
    Transaction: {
      Reference1: orderId.toString(),
      Reference2: "",
      Reference3: "",
      Reference4: "",
      Reference5: ""
    }
  };

  try {
    const trackRes = await axios.post(
      'https://ws.sbx.aramex.net/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments',
      trackPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    console.log(`📦 Manual Tracking for Order ${orderId}:`, JSON.stringify(trackRes.data, null, 2));
    res.status(200).json(trackRes.data);
  } catch (error) {
    console.error('❌ Tracking Error:', error.response?.data || error.message);
    res.status(500).send('Tracking failed');
  }
});

app.get('/', (req, res) => {
  res.status(200).send('Aramex Integration Server is up and running');
});


app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
