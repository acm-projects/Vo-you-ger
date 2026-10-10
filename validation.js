const form = document.getElementById('form');
const firstname_input = document.getElementById('firstname-input');
const email_input = document.getElementById('email-input');
const password_input = document.getElementById('password-input');
const repeat_password_input = document.getElementById('repeat-password-input');
const error_message = document.getElementById('error-message');
const country_input = document.getElementById('country-input');
const countriesList = document.getElementById('countries-list');
const selectedCountriesContainer = document.getElementById('selected-countries-container');

// list of all countries in dropdown
const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", 
  "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", 
  "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", 
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", 
  "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", 
  "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", 
  "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", 
  "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", 
  "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", 
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", 
  "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", 
  "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", 
  "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", 
  "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", 
  "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", 
  "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", 
  "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", 
  "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", 
  "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", 
  "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", 
  "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

// Populate datalist dropdown
if (countriesList) {
  countries.forEach(country => {
    const option = document.createElement('option');
    option.value = country;
    countriesList.appendChild(option);
  });
}

// Add country tag when selected from list or typed
if (country_input && selectedCountriesContainer) {
  country_input.addEventListener('change', () => {
    const val = country_input.value.trim();
    if (countries.includes(val)) {
      addCountryTag(val);
      country_input.value = '';
    }
  });
}

function addCountryTag(countryName) {
  // Prevent duplicates
  const existingInputs = selectedCountriesContainer.querySelectorAll('.country-field');
  for (let input of existingInputs) {
    if (input.value === countryName) return;
  }

  const tag = document.createElement('span');
  tag.className = 'country-tag';
  tag.innerText = countryName + ' ';

  const hiddenInput = document.createElement('input');
  hiddenInput.type = 'hidden';
  hiddenInput.name = 'countries[]';
  hiddenInput.value = countryName;
  hiddenInput.className = 'country-field';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.innerText = '×';
  removeBtn.onclick = () => tag.remove();

  tag.appendChild(hiddenInput);
  tag.appendChild(removeBtn);
  selectedCountriesContainer.appendChild(tag);
}

form.addEventListener('submit', (e) => {
  let errors = [];

  if (firstname_input) {
    errors = getSignupFormErros(
      firstname_input.value,
      email_input.value,
      password_input.value,
      repeat_password_input.value
    );
  } else {
    errors = getLoginFormErros(email_input.value, password_input.value);
  }

  if (errors.length > 0) {
    e.preventDefault();
    error_message.innerText = errors.join(". ");
  }
});

function getSignupFormErros(firstname, email, password, repeat_password) {
  let errors = [];

  if (!firstname) {
    errors.push('Firstname is required');
    firstname_input.parentElement.classList.add('incorrect');
  }
  if (!email) {
    errors.push('Email is required');
    email_input.parentElement.classList.add('incorrect');
  }
  if (!password) {
    errors.push('Password is required');
    password_input.parentElement.classList.add('incorrect');
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
    password_input.parentElement.classList.add('incorrect');
  }
  if (password !== repeat_password) {
    errors.push('Passwords do not match');
    password_input.parentElement.classList.add('incorrect');
    repeat_password_input.parentElement.classList.add('incorrect');
  }

  const countryInputs = document.querySelectorAll('.country-field');
  let hasValidCountry = false;

  countryInputs.forEach(input => {
    const val = input.value.trim();
    if (val !== '') {
      if (countries.includes(val)) {
        hasValidCountry = true;
      } else {
        errors.push(`"${val}" is not a valid country`);
      }
    }
  });

  if (!hasValidCountry) {
    errors.push('At least one country of citizenship is required');
    if (country_input) {
      country_input.closest('form > div').classList.add('incorrect');
    }
  }

  return errors;
}

function getLoginFormErros(email, password) {
  let errors = [];
  if (!email) {
    errors.push('Email is required');
    email_input.parentElement.classList.add('incorrect');
  }
  if (!password) {
    errors.push('Password is required');
    password_input.parentElement.classList.add('incorrect');
  }
  return errors;
}