const form = document.getElementById("form");
const firstname_input = document.getElementById("firstname-input");
const lastname_input = document.getElementById("lastname-input");
const email_input = document.getElementById("email-input");
const password_input = document.getElementById("password-input");
const repeat_password_input = document.getElementById("repeat-password-input");
const error_message = document.getElementById("error-message");
const country_input = document.getElementById("country-input");
const countriesList = document.getElementById("countries-list");
const selectedCountriesContainer = document.getElementById(
  "selected-countries-container",
);

// Keep this in sync with the password rule in server/controllers/authController.js
const MIN_PASSWORD_LENGTH = 6;

// Country name -> ISO 3166-1 alpha-2 code (used to build the flag emoji)
const countryCodes = {
  Afghanistan: "AF",
  Albania: "AL",
  Algeria: "DZ",
  Andorra: "AD",
  Angola: "AO",
  "Antigua and Barbuda": "AG",
  Argentina: "AR",
  Armenia: "AM",
  Australia: "AU",
  Austria: "AT",
  Azerbaijan: "AZ",
  Bahamas: "BS",
  Bahrain: "BH",
  Bangladesh: "BD",
  Barbados: "BB",
  Belarus: "BY",
  Belgium: "BE",
  Belize: "BZ",
  Benin: "BJ",
  Bhutan: "BT",
  Bolivia: "BO",
  "Bosnia and Herzegovina": "BA",
  Botswana: "BW",
  Brazil: "BR",
  Brunei: "BN",
  Bulgaria: "BG",
  "Burkina Faso": "BF",
  Burundi: "BI",
  "Cabo Verde": "CV",
  Cambodia: "KH",
  Cameroon: "CM",
  Canada: "CA",
  "Central African Republic": "CF",
  Chad: "TD",
  Chile: "CL",
  China: "CN",
  Colombia: "CO",
  Comoros: "KM",
  Congo: "CG",
  "Costa Rica": "CR",
  Croatia: "HR",
  Cuba: "CU",
  Cyprus: "CY",
  "Czech Republic": "CZ",
  Denmark: "DK",
  Djibouti: "DJ",
  Dominica: "DM",
  "Dominican Republic": "DO",
  Ecuador: "EC",
  Egypt: "EG",
  "El Salvador": "SV",
  "Equatorial Guinea": "GQ",
  Eritrea: "ER",
  Estonia: "EE",
  Eswatini: "SZ",
  Ethiopia: "ET",
  Fiji: "FJ",
  Finland: "FI",
  France: "FR",
  Gabon: "GA",
  Gambia: "GM",
  Georgia: "GE",
  Germany: "DE",
  Ghana: "GH",
  Greece: "GR",
  Grenada: "GD",
  Guatemala: "GT",
  Guinea: "GN",
  "Guinea-Bissau": "GW",
  Guyana: "GY",
  Haiti: "HT",
  Honduras: "HN",
  "Hong Kong": "HK",
  Hungary: "HU",
  Iceland: "IS",
  India: "IN",
  Indonesia: "ID",
  Iran: "IR",
  Iraq: "IQ",
  Ireland: "IE",
  Israel: "IL",
  Italy: "IT",
  Jamaica: "JM",
  Japan: "JP",
  Jordan: "JO",
  Kazakhstan: "KZ",
  Kenya: "KE",
  Kiribati: "KI",
  Kuwait: "KW",
  Kyrgyzstan: "KG",
  Laos: "LA",
  Latvia: "LV",
  Lebanon: "LB",
  Lesotho: "LS",
  Liberia: "LR",
  Libya: "LY",
  Liechtenstein: "LI",
  Lithuania: "LT",
  Luxembourg: "LU",
  Macau: "MO",
  Madagascar: "MG",
  Malawi: "MW",
  Malaysia: "MY",
  Maldives: "MV",
  Mali: "ML",
  Malta: "MT",
  "Marshall Islands": "MH",
  Mauritania: "MR",
  Mauritius: "MU",
  Mexico: "MX",
  Micronesia: "FM",
  Moldova: "MD",
  Monaco: "MC",
  Mongolia: "MN",
  Montenegro: "ME",
  Morocco: "MA",
  Mozambique: "MZ",
  Myanmar: "MM",
  Namibia: "NA",
  Nauru: "NR",
  Nepal: "NP",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Nicaragua: "NI",
  Niger: "NE",
  Nigeria: "NG",
  "North Korea": "KP",
  "North Macedonia": "MK",
  Norway: "NO",
  Oman: "OM",
  Pakistan: "PK",
  Palau: "PW",
  Palestine: "PS",
  Panama: "PA",
  "Papua New Guinea": "PG",
  Paraguay: "PY",
  Peru: "PE",
  Philippines: "PH",
  Poland: "PL",
  Portugal: "PT",
  Qatar: "QA",
  Romania: "RO",
  Russia: "RU",
  Rwanda: "RW",
  "Saint Kitts and Nevis": "KN",
  "Saint Lucia": "LC",
  "Saint Vincent and the Grenadines": "VC",
  Samoa: "WS",
  "San Marino": "SM",
  "Sao Tome and Principe": "ST",
  "Saudi Arabia": "SA",
  Senegal: "SN",
  Serbia: "RS",
  Seychelles: "SC",
  "Sierra Leone": "SL",
  Singapore: "SG",
  Slovakia: "SK",
  Slovenia: "SI",
  "Solomon Islands": "SB",
  Somalia: "SO",
  "South Africa": "ZA",
  "South Korea": "KR",
  "South Sudan": "SS",
  Spain: "ES",
  "Sri Lanka": "LK",
  Sudan: "SD",
  Suriname: "SR",
  Sweden: "SE",
  Switzerland: "CH",
  Syria: "SY",
  Taiwan: "TW",
  Tajikistan: "TJ",
  Tanzania: "TZ",
  Thailand: "TH",
  "Timor-Leste": "TL",
  Togo: "TG",
  Tonga: "TO",
  "Trinidad and Tobago": "TT",
  Tunisia: "TN",
  Turkey: "TR",
  Turkmenistan: "TM",
  Tuvalu: "TV",
  Uganda: "UG",
  Ukraine: "UA",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States": "US",
  Uruguay: "UY",
  Uzbekistan: "UZ",
  Vanuatu: "VU",
  "Vatican City": "VA",
  Venezuela: "VE",
  Vietnam: "VN",
  Yemen: "YE",
  Zambia: "ZM",
  Zimbabwe: "ZW",
};

// Plain list of country names (used for validation)
const countries = Object.keys(countryCodes);

// A flag emoji is just two "regional indicator" characters.
// 0x1F1E6 is the regional indicator for "A", so we shift each letter of the code.
function flagEmoji(code) {
  return String.fromCodePoint(
    ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
  );
}

// Text shown in the dropdown and on tags, e.g. "🇫🇷 France"
function displayName(countryName) {
  return `${flagEmoji(countryCodes[countryName])} ${countryName}`;
}

// Lookup from the dropdown text back to the plain country name
const displayToName = new Map(
  countries.map((name) => [displayName(name), name]),
);

// Populate datalist dropdown (signup page only)
if (countriesList) {
  countries.forEach((country) => {
    const option = document.createElement("option");
    option.value = displayName(country);
    countriesList.appendChild(option);
  });
}

// Add country tag when selected from list or typed (signup page only)
if (country_input && selectedCountriesContainer) {
  country_input.addEventListener("change", () => {
    const typed = country_input.value.trim();
    // Accept either "🇫🇷 France" (picked from the list) or plain "France" (typed)
    const name =
      displayToName.get(typed) || (countries.includes(typed) ? typed : null);
    if (name) {
      addCountryTag(name);
      country_input.value = "";
    }
  });
}

function addCountryTag(countryName) {
  // Prevent duplicates
  const existingInputs = selectedCountriesContainer.querySelectorAll(
    'input[name="countries[]"]',
  );
  for (let input of existingInputs) {
    if (input.value === countryName) return;
  }

  const tag = document.createElement("span");
  tag.className = "country-tag";
  tag.innerText = displayName(countryName) + " ";

  // The hidden input keeps the plain name (no emoji): this is the value
  // that will eventually be sent to the backend as "nationalities".
  const hiddenInput = document.createElement("input");
  hiddenInput.type = "hidden";
  hiddenInput.name = "countries[]";
  hiddenInput.value = countryName;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.innerText = "×";
  removeBtn.onclick = () => tag.remove();

  tag.appendChild(hiddenInput);
  tag.appendChild(removeBtn);
  selectedCountriesContainer.appendChild(tag);
}

// Reset the error message and any red highlighting from a previous attempt
function clearErrors() {
  error_message.innerText = "";
  document
    .querySelectorAll(".incorrect")
    .forEach((el) => el.classList.remove("incorrect"));
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors();

  let errors = [];

  if (firstname_input) {
    errors = getSignupFormErrors(
      firstname_input.value,
      lastname_input ? lastname_input.value : "",
      email_input.value,
      password_input.value,
      repeat_password_input.value,
    );
  } else {
    errors = getLoginFormErrors(email_input.value, password_input.value);
  }

  if (errors.length > 0) {
    error_message.innerText = errors.join(". ");
    return;
  }

  // Disable the submit button so user doesn't double-click
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerText;
  submitBtn.disabled = true;
  submitBtn.innerText = "Please wait...";

  try {
    const isSignup = !!firstname_input;
    const endpoint = isSignup
      ? "http://localhost:8080/api/auth/register"
      : "http://localhost:8080/api/auth/login";

    let requestBody = {};

    if (isSignup) {
      const fName = firstname_input.value.trim();
      const lName = lastname_input ? lastname_input.value.trim() : "";

      // Collect nationalities selected from the tags
      const countryInputs = selectedCountriesContainer.querySelectorAll(
        'input[name="countries[]"]',
      );
      const nationalities = Array.from(countryInputs).map(
        (input) => input.value,
      );

      requestBody = {
        fName,
        lName,
        email: email_input.value.trim(),
        password: password_input.value,
        nationalities,
      };
    } else {
      // Login body
      requestBody = {
        email: email_input.value.trim(),
        password: password_input.value,
      };
    }

    // 3. Make the network request to Express
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    // 4. Handle backend errors (e.g. "Invalid email or password", "User already exists")
    if (!response.ok) {
      error_message.innerText =
        data.message || data.error || "Something went wrong";
      submitBtn.disabled = false;
      submitBtn.innerText = originalBtnText;
      return;
    }

    // 5. Success! Save token and user into localStorage
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    // 6. Redirect to the main React homepage
    // After signup, start the travel assessment.
// After login, return to the homepage.
  if (isSignup) {
     window.location.href = "/Assessments/assessments.html";
  } else {
     window.location.href = "/";
  }
  } catch (err) {
    console.error("Network error:", err);
    error_message.innerText =
      "Unable to connect to server. Is the backend running?";
    submitBtn.disabled = false;
    submitBtn.innerText = originalBtnText;
  }
});

function getSignupFormErrors(
  firstname,
  lastname,
  email,
  password,
  repeat_password,
) {
  let errors = [];

  if (!firstname) {
    errors.push("First name is required");
    firstname_input.parentElement.classList.add("incorrect");
  }
  if (!lastname) {
    errors.push("Last name is required");
    if (lastname_input) lastname_input.parentElement.classList.add("incorrect");
  }
  if (!email) {
    errors.push("Email is required");
    email_input.parentElement.classList.add("incorrect");
  }
  if (!password) {
    errors.push("Password is required");
    password_input.parentElement.classList.add("incorrect");
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    );
    password_input.parentElement.classList.add("incorrect");
  }
  if (password !== repeat_password) {
    errors.push("Passwords do not match");
    password_input.parentElement.classList.add("incorrect");
    repeat_password_input.parentElement.classList.add("incorrect");
  }

  // Only countries added as tags count (tags are only created for valid countries)
  const selectedCountries = selectedCountriesContainer.querySelectorAll(
    'input[name="countries[]"]',
  );
  if (selectedCountries.length === 0) {
    errors.push("At least one country of citizenship is required");
    country_input.closest("form > div").classList.add("incorrect");
  }

  return errors;
}

function getLoginFormErrors(email, password) {
  let errors = [];
  if (!email) {
    errors.push("Email is required");
    email_input.parentElement.classList.add("incorrect");
  }
  if (!password) {
    errors.push("Password is required");
    password_input.parentElement.classList.add("incorrect");
  }
  return errors;
}
