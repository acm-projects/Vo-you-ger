<div align="center">
  <img src="https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MnFuanh5dTFoeTY4dDMzZnI3cWZ3dWRqc2hrdnMwejVxMDN6eWxtaSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Mag61RVXOxPu8lrM9X/giphy.gif">
</div>

# Vo(you)ger ✈️🌎

Planning a trip can mean jumping between maps, travel sites, transportation apps, weather services, attraction guides, and review platforms just to answer one question:

**"Where should I go, and what should I do when I get there?"**

Vo(you)ger is a personalized travel-planning web application designed to answer that question for you.

By combining a short personality assessment with budget, transportation preferences, trip duration, and activity interests, Vo(you)ger recommends destinations and determines the transportation options that best fit each traveler. It also provides personalized attractions both **at the destination and along the journey**, helping users discover experiences that match their individual travel style.

The goal is simple: **spend less time planning and more time having fun.** 🎒

## MVP 🏆

- **Personality Assessment**
  - Budget
  - Preferred transportation
  - Trip duration
  - Indoor vs. outdoor activities
  - Adventure vs. relaxation
  - Food interests
  - Nature vs. city preference
  - Family, solo, or group travel

- **Personalized Destination Recommendations**
  - Match destinations to personality and activity preferences
  - Consider budget, distance, transportation preferences, and trip duration
  - Rank destinations according to overall compatibility

- **Transportation Comparison**
  - Compare multiple transportation methods
  - Estimated cost
  - Estimated travel time
  - Distance
  - Number of transfers
  - Fuel estimates for driving

- **Transportation Recommendation Engine**
  - Weighted recommendation algorithm
  - Balances cost, time, convenience, distance, transfers, and user preferences
  - Recommends the best overall option rather than simply the fastest option

- **Personalized Attractions**
  - Attractions based on user interests
  - Recommendations at the destination
  - Attractions along road-trip routes
  - AI-generated explanations for why an attraction fits the traveler

- **Crowd Tracking**
  - Use publicly available crowd and traffic information when available
  - Recommend less crowded visiting times
  - Identify potentially lower-wait periods

## Stretch Goals 🚀

- Real-time weather and forecasts
- Weather-based travel recommendations
- Travel advisories and weather alerts
- Road closures
- Health notices
- Local news
- Interactive Google Maps integration
- Route visualization for transportation and attractions

## Timeline 🗓️

<table align="center">
  <thead>
    <tr>
      <th>Week</th>
      <th>Frontend (React/UI)</th>
      <th>Backend (API & AI)</th>
      <th>Deliverables</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><strong>Week 1</strong></td>
      <td>
        <ul>
          <li>Finalize project scope</li>
          <li>Assign team roles</li>
          <li>Create GitHub repository</li>
          <li>Install development tools</li>
          <li>Design Figma wireframes</li>
          <li>Learn React fundamentals</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Research travel APIs (Google Places, OpenRouteService, OpenWeather)</li>
          <li>Research OpenAI API or other AI options</li>
          <li>Design backend architecture</li>
          <li>Create database schema if needed</li>
          <li>Learn Express fundamentals</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Project architecture completed</li>
          <li>Development environment configured</li>
          <li>Wireframes finalized</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="center"><strong>Week 2</strong></td>
      <td>
        <ul>
          <li>Create React application using Vite</li>
          <li>Configure Tailwind CSS</li>
          <li>Create homepage</li>
          <li>Create navigation bar</li>
          <li>Create assessment page layout</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Build Express server</li>
          <li>Establish frontend-backend communication</li>
          <li>Set up authentication</li>
          <li>Begin assessment setup</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Functional homepage</li>
          <li>Backend server running</li>
          <li>Authentication finished</li>
          <li>Successful frontend/backend communication</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="center"><strong>Week 3</strong></td>
      <td>
        <ul>
          <li>Build personality assessment form</li>
          <li>Add form validation</li>
          <li>Create reusable question components</li>
          <li>Add progress indicator</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Process assessment responses</li>
          <li>Begin recommendation engine logic</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Working assessment</li>
          <li>User responses stored and sent to backend</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="center"><strong>Week 4</strong></td>
      <td>
        <ul>
          <li>Create destination cards</li>
          <li>Create recommendation page</li>
          <li>Add loading indicators</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Integrate destination API (Google Places/OpenTripMap)</li>
          <li>Filter destinations based on assessment</li>
          <li>Filter destinations based on budget</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Personalized destination recommendations displayed</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="center"><strong>Week 5</strong></td>
      <td>
        <ul>
          <li>Build transportation comparison page</li>
          <li>Create comparison cards</li>
          <li>Create route display components</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Integrate routing API</li>
          <li>Calculate travel distance</li>
          <li>Calculate travel time</li>
          <li>Calculate fuel estimates</li>
          <li>Compare transportation methods</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Transportation comparison system complete</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="center"><strong>Week 6</strong></td>
      <td>
        <ul>
          <li>Build attractions dashboard</li>
          <li>Create attraction cards</li>
          <li>Add filtering options</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Integrate attraction APIs</li>
          <li>Retrieve attractions for destination</li>
          <li>Retrieve attractions along routes</li>
          <li>Generate AI travel summaries</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Personalized attractions displayed</li>
          <li>AI explanations for recommendations</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="center"><strong>Week 7</strong></td>
      <td>
        <ul>
          <li>Improve UI responsiveness</li>
          <li>Add animations</li>
          <li>Improve accessibility</li>
          <li>Refine user experience</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Finish weighted transportation recommendation algorithm</li>
          <li>Optimize recommendation logic</li>
          <li>Improve API error handling</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Fully functional recommendation engine</li>
          <li>Polished interface</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="center"><strong>Week 8</strong></td>
      <td>
        <ul>
          <li>Finalize styling</li>
          <li>Prepare presentation slides</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Complete testing</li>
          <li>Prepare demo</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Feature-complete application</li>
          <li>Presentation draft and demo completed</li>
        </ul>
      </td>
    </tr>
    <tr>
      <td align="center"><strong>Week 9</strong></td>
      <td>
        <ul>
          <li>Freeze UI changes</li>
          <li>Finish demo</li>
          <li>Rehearse presentation</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Freeze development</li>
          <li>Memorize full presentation</li>
        </ul>
      </td>
      <td>
        <ul>
          <li>Demo and presentation perfected</li>
        </ul>
      </td>
    </tr>
  </tbody>
</table>

## Tech Stack & Resources 💻

<details>
<summary><strong>Frontend</strong></summary>

### React + Vite

React provides the component-based architecture for building Vo(you)ger's interactive interface, while Vite provides a fast development environment and production build system.

- [React Documentation](https://react.dev/)
- [React Learn](https://react.dev/learn)
- [React Quick Start](https://react.dev/learn)
- [React API Reference](https://react.dev/reference/react)
- [React YouTube Tutorial](https://www.youtube.com/watch?v=hn80mWvP-9g)
- [React Tutorial for Beginners](https://www.youtube.com/watch?v=Tn6-PIqc4UM)
- [Vite Documentation](https://vite.dev/guide/)
- [Vite Getting Started](https://vite.dev/guide/)
- [Vite Configuration](https://vite.dev/config/)

### Tailwind CSS

Tailwind CSS will be used to create a responsive interface while allowing the team to rapidly build and iterate on UI components.

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind CSS Installation](https://tailwindcss.com/docs/installation)
- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Tailwind CSS Core Concepts](https://tailwindcss.com/docs/styling-with-utility-classes)
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Tailwind CSS Customization](https://tailwindcss.com/docs/theme)

### React Router

React Router can be used to organize application navigation between the assessment, recommendations, transportation, and attraction pages.

- [React Router Documentation](https://reactrouter.com/)
- [React Router Tutorials](https://reactrouter.com/start/library/installation)
- [React Router API](https://reactrouter.com/api)
- [React Router Concepts](https://reactrouter.com/home)

### Axios

Axios will handle HTTP requests between the React frontend, Express backend, and external APIs.

- [Axios Documentation](https://axios-http.com/docs/intro)
- [Axios Request Config](https://axios-http.com/docs/req_config)
- [Axios API](https://axios-http.com/docs/api_intro)
- [Axios Error Handling](https://axios-http.com/docs/handling_errors)
- [Axios GitHub Repository](https://github.com/axios/axios)

### Figma

Figma will be used for wireframes, interface design, prototyping, and collaboration before implementation.

- [Figma](https://www.figma.com/)
- [Figma Design](https://www.figma.com/design/)
- [Figma Learn](https://help.figma.com/hc/en-us/categories/145441011417)
- [Figma Community](https://www.figma.com/community)

</details>

<details>
<summary><strong>Backend</strong></summary>

### Node.js

Node.js provides the runtime environment for the Vo(you)ger backend.

- [Node.js Official Website](https://nodejs.org/)
- [Node.js Documentation](https://nodejs.org/docs/latest/api/)
- [Node.js Learn](https://nodejs.org/en/learn)
- [Node.js Downloads](https://nodejs.org/en/download)
- [Node.js Introduction](https://nodejs.org/en/learn/getting-started/introduction-to-nodejs)
- [Node.js Crash Course](https://www.youtube.com/watch?v=32M1al-Y6Ag)

### Express.js

Express will provide the REST API layer connecting the frontend to recommendation logic and external travel services.

- [Express Documentation](https://expressjs.com/)
- [Express Getting Started](https://expressjs.com/en/starter/installing.html)
- [Express Routing](https://expressjs.com/en/guide/routing.html)
- [Express Middleware](https://expressjs.com/en/guide/using-middleware.html)
- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)
- [Express API Reference](https://expressjs.com/en/4x/api.html)

### Postman

Postman will be used to develop, test, and debug REST API endpoints before integrating them with the React frontend.

- [Postman](https://www.postman.com/)
- [Postman Downloads](https://www.postman.com/downloads/)
- [Postman Learning Center](https://learning.postman.com/)
- [Postman API Testing](https://learning.postman.com/docs/tests-and-scripts/)
- [Postman Collections](https://learning.postman.com/docs/collections/)
- [Postman Environments](https://learning.postman.com/docs/sending-requests/managing-environments/)
- [Postman Scripts](https://learning.postman.com/docs/tests-and-scripts/write-scripts/intro-to-scripts/)

</details>

<details>
<summary><strong>AI & Travel APIs</strong></summary>

### Google Places API

Google Places provides information about locations, destinations, attractions, and other points of interest. It can support both destination discovery and attraction recommendations.

- [Google Maps Platform](https://developers.google.com/maps)
- [Google Places API Documentation](https://developers.google.com/maps/documentation/places/web-service)
- [Places API Overview](https://developers.google.com/maps/documentation/places/web-service/overview)
- [Place Search](https://developers.google.com/maps/documentation/places/web-service/text-search)
- [Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search)
- [Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details)
- [Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos)
- [Google Maps Platform Pricing](https://mapsplatform.google.com/pricing/)
- [Google Maps Platform API Keys](https://developers.google.com/maps/api-security-best-practices)

### OpenRouteService

OpenRouteService can provide routing information used to estimate driving distances and travel times and support route-based attraction discovery.

- [OpenRouteService](https://openrouteservice.org/)
- [OpenRouteService Developer Portal](https://openrouteservice.org/dev)
- [OpenRouteService API Documentation](https://giscience.github.io/openrouteservice/)
- [Directions API](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/)
- [Geocoding API](https://giscience.github.io/openrouteservice/api-reference/endpoints/geocoder/)
- [Isochrones API](https://giscience.github.io/openrouteservice/api-reference/endpoints/isochrones/)
- [Matrix API](https://giscience.github.io/openrouteservice/api-reference/endpoints/matrix/)
- [OpenRouteService GitHub](https://github.com/GIScience/openrouteservice)

### OpenWeather

OpenWeather can provide current conditions and forecasts for the weather-based stretch goals.

- [OpenWeather](https://openweathermap.org/)
- [OpenWeather API](https://openweathermap.org/api)
- [Current Weather API](https://openweathermap.org/current)
- [5 Day / 3 Hour Forecast](https://openweathermap.org/forecast5)
- [One Call API](https://openweathermap.org/api/one-call-3)

### OpenAI API

An AI model can be used to generate personalized explanations, travel summaries, and potentially assist with recommendation reasoning.

- [OpenAI Platform](https://platform.openai.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)
- [OpenAI Quickstart](https://platform.openai.com/docs/quickstart)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [OpenAI Developer Resources](https://developers.openai.com/)
- [OpenAI Cookbook](https://cookbook.openai.com/)
- [OpenAI API Pricing](https://openai.com/api/pricing/)

### NewsAPI

NewsAPI can support the travel-advisory and local-news stretch goals.

- [NewsAPI](https://newsapi.org/)
- [NewsAPI Documentation](https://newsapi.org/docs)
- [NewsAPI Getting Started](https://newsapi.org/docs/get-started)
- [NewsAPI Endpoints](https://newsapi.org/docs/endpoints)
- [NewsAPI Pricing](https://newsapi.org/pricing)

### OpenTripMap

OpenTripMap can serve as an additional source for attractions and destination information.

- [OpenTripMap](https://opentripmap.io/)
- [OpenTripMap API](https://opentripmap.io/product)
- [OpenTripMap API Documentation](https://opentripmap.io/docs)

</details>

<details>
<summary><strong>Maps & Location Resources</strong></summary>

### Google Maps

Google Maps can support the interactive-map stretch goal, allowing users to visualize routes, destinations, and attractions.

- [Google Maps Platform](https://developers.google.com/maps)
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [Maps JavaScript API Documentation](https://developers.google.com/maps/documentation/javascript/overview)
- [Google Maps Routes](https://developers.google.com/maps/documentation/routes)
- [Google Maps Platform Samples](https://developers.google.com/maps/documentation/javascript/examples)

### General Mapping Concepts

Understanding geocoding, coordinates, routes, distance matrices, and geographic data will be useful when implementing route-based recommendations.

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [OpenStreetMap](https://www.openstreetmap.org/)
- [OpenStreetMap Wiki](https://wiki.openstreetmap.org/)
- [GeoJSON Specification](https://geojson.org/)

</details>

<details>
<summary><strong>Developer Tools</strong></summary>

### VS Code

- [VS Code](https://code.visualstudio.com/)
- [VS Code Download](https://code.visualstudio.com/download)
- [VS Code Documentation](https://code.visualstudio.com/docs)
- [VS Code Tips and Tricks](https://code.visualstudio.com/docs/getstarted/tips-and-tricks)

### Git

- [Git](https://git-scm.com/)
- [Git Downloads](https://git-scm.com/downloads)
- [Git Documentation](https://git-scm.com/doc)
- [Git Book](https://git-scm.com/book/en/v2)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
- [GitHub Git Guides](https://github.com/git-guides)

### GitHub

- [GitHub](https://github.com/)
- [GitHub Docs](https://docs.github.com/)
- [GitHub Skills](https://skills.github.com/)
- [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)
- [GitHub Issues](https://docs.github.com/en/issues)
- [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [GitHub Pull Requests](https://docs.github.com/en/pull-requests)

</details>

## Software to Install 🛠️

Before beginning development, make sure the following tools are installed:

- **IDE:** [VS Code](https://code.visualstudio.com/download)
- **Version Control:** [Git](https://git-scm.com/downloads)
- **Runtime:** [Node.js](https://nodejs.org/download)
- **API Testing:** [Postman](https://www.postman.com/downloads/)
- **Design:** [Figma](https://www.figma.com/downloads/)

## Recommendation System 🧠

Vo(you)ger's recommendation system is designed to consider multiple factors instead of making decisions based on a single preference.

A destination can be evaluated using factors such as:

| Factor         | Description                                                                   |
| -------------- | ----------------------------------------------------------------------------- |
| Budget         | How well the destination fits the user's spending range                       |
| Distance       | How practical the destination is based on travel distance                     |
| Transportation | Whether the destination supports the user's preferred travel method           |
| Activities     | How closely available attractions match user interests                        |
| Trip Duration  | Whether the destination fits the available vacation length                    |
| Travel Style   | Adventure, relaxation, food, nature, city, family, solo, or group preferences |

Transportation recommendations similarly consider:

| Factor      | Description                            |
| ----------- | -------------------------------------- |
| Cost        | Estimated transportation expense       |
| Travel Time | Expected duration of the trip          |
| Preference  | User's preferred transportation method |
| Transfers   | Number of transfers required           |
| Convenience | Overall ease of the journey            |
| Distance    | Total distance traveled                |

The exact weighting can be adjusted during development based on testing and user feedback.

## Potential Competition ⚔️

### Google Travel

Google Travel helps users discover flights, hotels, destinations, and attractions.

**Vo(you)ger's advantage:** Instead of requiring users to organize information themselves, Vo(you)ger focuses on automatically matching destinations, transportation, and activities to a user's personality and budget.

### Roadtrippers

Roadtrippers focuses heavily on road-trip planning and discovering attractions along driving routes.

**Vo(you)ger's advantage:** Vo(you)ger is designed to support multiple transportation methods while also considering a user's individual travel personality and preferences.

### TripAdvisor

TripAdvisor provides extensive destination information, reviews, and attraction discovery.

**Vo(you)ger's advantage:** Vo(you)ger focuses on personalized recommendations generated from a user's preferences rather than requiring the traveler to manually search through large amounts of information.

### Expedia

Expedia focuses primarily on travel bookings such as flights, hotels, and vacation packages.

**Vo(you)ger's advantage:** Vo(you)ger focuses on the planning and discovery stage, helping users determine where they should go, how they should get there, and what they should do before making booking decisions.

## Git Cheatsheet 📓

| Command                               | What it does                                        |
| ------------------------------------- | --------------------------------------------------- |
| `git init`                            | Initialize a new Git repository                     |
| `git clone "rep-url"`                 | Clone an existing repository                        |
| `git status`                          | Show the current state of the working directory     |
| `git add .`                           | Add all changes to staging                          |
| `git add "file"`                      | Add a specific file to staging                      |
| `git commit -m "Descriptive Message"` | Create a commit                                     |
| `git push`                            | Upload local commits to the remote repository       |
| `git pull`                            | Fetch and merge remote changes                      |
| `git fetch`                           | Fetch remote changes without merging                |
| `git log`                             | View commit history                                 |
| `git branch`                          | List branches                                       |
| `git branch "branch-name"`            | Create a new branch                                 |
| `git checkout "branch-name"`          | Switch branches                                     |
| `git checkout -b "branch-name"`       | Create and switch to a new branch                   |
| `git merge "branch-name"`             | Merge a branch into the current branch              |
| `git branch -d "branch-name"`         | Delete a local branch                               |
| `git push origin "branch-name"`       | Push a specific branch                              |
| `git pull origin "branch-name"`       | Pull changes from a specific branch                 |
| `git reset --hard HEAD`               | Discard uncommitted changes                         |
| `git revert <commit-hash>`            | Create a new commit that reverses a previous commit |

## Vo(you)ger Team 👥

- Kin Ma
- Member 2
- Member 3
- Member 4
- Project Manager
- Industry Mentor
