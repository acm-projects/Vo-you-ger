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
    "selected-countries-container"
);

// Keep this in sync with the password rule in server/controllers/authController.js
const MIN_PASSWORD_LENGTH = 6;


// =====================================
// COUNTRY CODES
// =====================================

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
    Zimbabwe: "ZW"
};


// =====================================
// COUNTRY AND FLAG FUNCTIONS
// =====================================

const countries = Object.keys(countryCodes);

function flagEmoji(code) {
    return String.fromCodePoint(
        ...[...code].map(
            letter => 0x1f1e6 + letter.charCodeAt(0) - 65
        )
    );
}

function displayName(countryName) {
    return `${flagEmoji(countryCodes[countryName])} ${countryName}`;
}

const displayToName = new Map(
    countries.map(name => [displayName(name), name])
);


// Populate country dropdown
if (countriesList) {

    countries.forEach(country => {

        const option = document.createElement("option");

        option.value = displayName(country);

        countriesList.appendChild(option);

    });

}


// =====================================
// COUNTRY SELECTION
// =====================================

if (country_input && selectedCountriesContainer) {

    country_input.addEventListener("change", () => {

        const typed = country_input.value.trim();

        const name =
            displayToName.get(typed) ||
            (countries.includes(typed) ? typed : null);

        if (name) {

            addCountryTag(name);

            country_input.value = "";

        }

    });

}


function addCountryTag(countryName) {

    // Prevent duplicates
    const existingInputs =
        selectedCountriesContainer.querySelectorAll(
            'input[name="countries[]"]'
        );

    for (let input of existingInputs) {

        if (input.value === countryName) return;

    }


    const tag = document.createElement("span");

    tag.className = "country-tag";

    tag.innerText = displayName(countryName) + " ";


    // Hidden input stores the actual country name
    const hiddenInput = document.createElement("input");

    hiddenInput.type = "hidden";

    hiddenInput.name = "countries[]";

    hiddenInput.value = countryName;


    // Remove country button
    const removeBtn = document.createElement("button");

    removeBtn.type = "button";

    removeBtn.innerText = "×";

    removeBtn.onclick = () => tag.remove();


    tag.appendChild(hiddenInput);

    tag.appendChild(removeBtn);

    selectedCountriesContainer.appendChild(tag);

}


// =====================================
// CLEAR PREVIOUS ERRORS
// =====================================

function clearErrors() {

    if (error_message) {
        error_message.innerText = "";
    }

    document
        .querySelectorAll(".incorrect")
        .forEach(el => el.classList.remove("incorrect"));

}


// =====================================
// PASSWORD VALIDATION
// =====================================

function checkPasswordValidity() {

    if (!password_input || !repeat_password_input) return;

    const password = password_input.value;

    const repeatPassword = repeat_password_input.value;


    // Check minimum password length
    if (
        password.length > 0 &&
        password.length < MIN_PASSWORD_LENGTH
    ) {

        password_input.setCustomValidity(
            `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
        );

    } else {

        password_input.setCustomValidity("");

    }


    // Check whether passwords match
    if (
        repeatPassword !== "" &&
        password !== repeatPassword
    ) {

        repeat_password_input.setCustomValidity(
            "Passwords do not match"
        );

    } else {

        repeat_password_input.setCustomValidity("");

    }

}


// Run password validation while typing
if (
    firstname_input &&
    password_input &&
    repeat_password_input
) {

    password_input.addEventListener(
        "input",
        checkPasswordValidity
    );

    repeat_password_input.addEventListener(
        "input",
        checkPasswordValidity
    );

}


// =====================================
// SIGNUP FORM VALIDATION
// =====================================

function getSignupFormErrors(
    firstname,
    lastname,
    email,
    password,
    repeat_password
) {

    let errors = [];


    // First name
    if (!firstname.trim()) {

        errors.push("First name is required");

        firstname_input.parentElement.classList.add("incorrect");

    }


    // Last name
    if (!lastname.trim()) {

        errors.push("Last name is required");

        if (lastname_input) {

            lastname_input.parentElement.classList.add("incorrect");

        }

    }


    // Email
    if (!email.trim()) {

        errors.push("Email is required");

        email_input.parentElement.classList.add("incorrect");

    }


    // Password errors are handled by browser validation
    // using setCustomValidity() and reportValidity()


    // Country selection
    const selectedCountries =
        selectedCountriesContainer.querySelectorAll(
            'input[name="countries[]"]'
        );

    if (selectedCountries.length === 0) {

        errors.push("At least one country of citizenship is required");

        country_input
            .closest(".field-row")
            .classList.add("incorrect");

    }


    return errors;

}


// =====================================
// LOGIN FORM VALIDATION
// =====================================

function getLoginFormErrors(email, password) {

    let errors = [];


    if (!email.trim()) {

        errors.push("Email is required");

        email_input.parentElement.classList.add("incorrect");

    }


    if (!password) {

        errors.push("Password is required");

        password_input.parentElement.classList.add("incorrect");

    }


    return errors;

}


// =====================================
// FORM SUBMISSION
// =====================================

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    clearErrors();


    const isSignup = !!firstname_input;


    // Update password validity before submitting
    if (isSignup) {

        checkPasswordValidity();

    }


    // Show native browser validation popup
    // beside the relevant input if invalid
    if (!form.reportValidity()) {

        return;

    }


    let errors = [];


    // Signup validation
    if (isSignup) {

        errors = getSignupFormErrors(
            firstname_input.value,
            lastname_input ? lastname_input.value : "",
            email_input.value,
            password_input.value,
            repeat_password_input.value
        );

    } else {

        // Login validation
        errors = getLoginFormErrors(
            email_input.value,
            password_input.value
        );

    }


    // Display remaining form errors
    if (errors.length > 0) {

        error_message.innerText = errors.join(". ");

        return;

    }


    // =====================================
    // DISABLE SUBMIT BUTTON
    // =====================================

    const submitBtn = form.querySelector(
        'button[type="submit"]'
    );

    const originalBtnText = submitBtn.innerText;

    submitBtn.disabled = true;

    submitBtn.innerText = "Please wait...";


    try {

        // =====================================
        // API ENDPOINT
        // =====================================

        const endpoint = isSignup
            ? "http://localhost:8080/api/auth/register"
            : "http://localhost:8080/api/auth/login";


        let requestBody = {};


        // =====================================
        // SIGNUP REQUEST BODY
        // =====================================

        if (isSignup) {

            const fName = firstname_input.value.trim();

            const lName = lastname_input.value.trim();


            // Collect selected countries
            const countryInputs =
                selectedCountriesContainer.querySelectorAll(
                    'input[name="countries[]"]'
                );

            const nationalities = Array.from(
                countryInputs
            ).map(input => input.value);


            requestBody = {

                fName,

                lName,

                email: email_input.value.trim(),

                password: password_input.value,

                nationalities

            };

        } else {

            // =====================================
            // LOGIN REQUEST BODY
            // =====================================

            requestBody = {

                email: email_input.value.trim(),

                password: password_input.value

            };

        }


        // =====================================
        // SEND REQUEST TO BACKEND
        // =====================================

        const response = await fetch(endpoint, {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify(requestBody)

        });


        const data = await response.json();


        // =====================================
        // HANDLE BACKEND ERRORS
        // =====================================

        if (!response.ok) {

            error_message.innerText =
                data.message ||
                data.error ||
                "Something went wrong";

            submitBtn.disabled = false;

            submitBtn.innerText = originalBtnText;

            return;

        }


        // =====================================
        // SAVE USER INFORMATION
        // =====================================

        localStorage.setItem(
            "token",
            data.token
        );

        localStorage.setItem(
            "user",
            JSON.stringify(data.user)
        );


        // =====================================
        // REDIRECT AFTER SUCCESS
        // =====================================

        if (isSignup) {

            // First-time users go to assessment
            window.location.href = "/Assessments/assessments.html";

        } else {

            // Existing users go to homepage
            window.location.href = "/";

        }


    } catch (err) {

        // =====================================
        // NETWORK ERROR
        // =====================================

        console.error("Network error:", err);

        error_message.innerText =
            "Unable to connect to server. Is the backend running?";

        submitBtn.disabled = false;

        submitBtn.innerText = originalBtnText;

    }

});
