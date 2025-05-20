const axios = require('axios');

// 🕒 تحويل التاريخ إلى صيغة Aramex المطلوبة
function toAramexDate(date) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = n => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const hours = pad(offset / 60);
  const minutes = pad(offset % 60);
  return `/Date(${date.getTime()}${sign}${hours}${minutes})/`;
}

// 🧠 كود تجربة ثابت - عدله حسب الحاجة لاحقًا
async function createPickup() {
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
    Pickup: {
      PickupAddress: {
        Line1: "Mecca St - Amman",
        Line2: "",
        Line3: "",
        City: "Amman",
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
      PickupContact: {
        Department: "",
        PersonName: "Waleed Khaled",
        Title: "",
        CompanyName: "Lombardia Store",
        PhoneNumber1: "962790000000",
        PhoneNumber1Ext: "",
        PhoneNumber2: "",
        PhoneNumber2Ext: "",
        FaxNumber: "",
        CellPhone: "962790000000",
        EmailAddress: "shpr@emailadress.com",
        Type: ""
      },
      PickupLocation: "Reception",
      PickupDate: toAramexDate(new Date()),
      ReadyTime: toAramexDate(new Date()),
      LastPickupTime: toAramexDate(new Date(Date.now() + 60 * 60 * 1000)), // بعد ساعة
      ClosingTime: toAramexDate(new Date(Date.now() + 2 * 60 * 60 * 1000)), // بعد ساعتين
      Comments: "",
      Reference1: "PickupRef123",
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
          ShipmentWeight: {
            Unit: "KG",
            Value: 0.5
          },
          ShipmentVolume: null,
          NumberOfPieces: 1,
          ShipmentDimensions: {
            Length: 0,
            Width: 0,
            Height: 0,
            Unit: ""
          },
          Comments: ""
        }
      ],
      Status: "Ready",
      ExistingShipments: null,
      Branch: "",
      RouteCode: ""
    },
    Transaction: {
      Reference1: "PickupRef123",
      Reference2: "",
      Reference3: "",
      Reference4: "",
      Reference5: ""
    },
    LabelInfo: {
      ReportID: 9201,
      ReportType: "URL"
    }
  };

  try {
    const response = await axios.post(
      'https://ws.sbx.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreatePickup',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    console.log("✅ Pickup created successfully:");
    console.log(response.data);
  } catch (error) {
    console.error("❌ Pickup creation failed:");
    console.error(error.response?.data || error.message);
  }
}

createPickup();
