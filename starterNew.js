'use strict';
//// PARANT CLASS:
class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords; // [coords[0] = lat, coords[1] = lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }
  async _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Get City and Country
    const location = await this._findLoc(this.coords[0], this.coords[1]);
    // console.log(location);

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()} ${location ? 'in' : ''} ${location.city}, ${
      location.country
    }`;
  }

  // Find Location, get City and Country
  async _findLoc(lat, lng) {
    // Nominatim API-URL, Reverse Geocoding
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      const address = data.address;
      const city =
        address.city || address.town || address.village || address.street || '';
      const country = address.country || '';
      return { city, country };
    } catch (error) {
      console.error(error);
    }
  }
}

// Inheritence between Classes - CHILD CLASSES:
class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// APPLICATION ARCHITECTURE - HOW:

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const confirm = document.querySelector('.confirm');
const deleteAll = document.querySelector('.deleteAll');
const sideBtns = document.querySelector('.sideBtns');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];

  constructor() {
    // Get users position
    this._getPosition();
    // Get data from local storage
    this._getLocalStorage();
    // Events to display new workouts, elevation field, moving to popup
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    this._containerEvents();
    deleteAll.addEventListener('click', this._deleteAll.bind(this));
    document
      .querySelector('.sortBtn')
      .addEventListener('click', this._sortByDate.bind(this));
    document
      .querySelector('.sortDist')
      .addEventListener('click', this._sortByDistance.bind(this));
    document
      .querySelector('.showAll')
      .addEventListener('click', this._showAll.bind(this));
  }

  _deleteAll() {
    this.#markers.forEach(m => m.remove());
    this.#markers = [];
    this.#workouts = [];
    document
      .querySelectorAll('li.workout')
      .forEach(w => w.classList.add('hidden'));
    sideBtns.classList.add('hidden');
  }

  _containerEvents() {
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._edit.bind(this));
    containerWorkouts.addEventListener('click', this._saveEdit.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
  }

  // Show All Workouts
  _showAll() {
    if (this.#workouts.length >= 2) {
      const workoutCoordinates = this.#workouts.map(workout => [
        workout.coords[0],
        workout.coords[1],
      ]);
      const bounds = new L.LatLngBounds(workoutCoordinates);
      this.#map.fitBounds(bounds);
    }
  }

  _getPosition() {
    if (navigator.geolocation);
    navigator.geolocation.getCurrentPosition(
      this._loadMap.bind(this),
      function () {
        confirm.innerHTML = 'Could not get your position.';
        confirm.classList.remove('hidden');
        // alert('Could not get your position');
      }
    );
  }

  _loadMap(position) {
    confirm.classList.add('hidden');
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

  // HOT Tile: 'https://tile.openstreetmap.de/hot/{z}/{x}/{y}.png'
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    sideBtns.classList.remove('hidden');

    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // is workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        confirm.innerHTML = 'Inputs have to be positive numbers.';
        return confirm.classList.remove('hidden');
      }
      // return alert('Inputs have to be positive numbers');
      confirm.classList.add('hidden');
      workout = new Running([lat, lng], distance, duration, cadence);
    }
    // is workout cycle, create cylce object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        confirm.innerHTML = 'Inputs have to be positive numbers.';
        return confirm.classList.remove('hidden');
      }
      // return alert('Inputs have to be positive numbers');
      confirm.classList.add('hidden');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // add new object to workout array
    this.#workouts.push(workout);
    // console.log(this.#workouts);
    // render workout on map as marker
    this._renderWorkoutMarker(workout);

    // rander workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  async _renderWorkoutMarker(workout) {
    await workout._setDescription();
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
    this.#markers.push(marker);
    return marker;
  }

  async _renderWorkout(workout) {
    await workout._setDescription();
    let html = `
     <li class="workout workout--${workout.type}" data-id="${workout.id}"> 
    <div class="editFlex">
          <h2 class="workout__title">${
            workout.description
          }</h2> <div class="editBtn"> ✎ </div><div class="saveBtn hidden"> ⇩ </div> 
           <div class="delete"> x </div>
         
          </div>
         <div class="editFlex"> 
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div> 
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div> `;

    if (workout.type === 'running')
      html += ` 
<div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div></div>
        </li>
`;

    if (workout.type === 'cycling')
      html += `
 <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div></div>
        </li>
`;

    form.insertAdjacentHTML('afterend', html);
  }
  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    // console.log(workoutEl);
    if (!workoutEl) return;
    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    //JSON Problem when using on OOP: converting element leads to lose prototype-property -
    if (!data) return;
    this.#workouts === data;
    this.#workouts.forEach(work => this._renderWorkout(work));
  }

  _edit(e) {
    const values = [];
    // Edit Button Click
    const btn = e.target.closest('.editBtn');
    const saveBtn = e.target.nextElementSibling;
    if (!btn) return;
    btn.classList.toggle('hidden');
    saveBtn.classList.toggle('hidden');
    confirm.innerHTML = 'Save to continue.';
    // alert('Inputs have to be positive numbers.');
    confirm.classList.remove('hidden');
    // Read Init Inputs:
    const getInp = e.target
      .closest('.editFlex')
      .nextElementSibling.querySelectorAll('.workout__value'); // console.log([...getInp]);

    e.target.closest('.editFlex').nextElementSibling.style.zIndex = 50;
    // Save Inputs
    getInp.forEach(i => {
      values.push(i.innerHTML);
      // console.log(values);
    });

    // Open Input fields with init values
    [...getInp].forEach((i, index) => {
      i.innerHTML = `<input class="editInput" value="${+values[
        index
      ]}" required></input>`;
    });
    [...document.querySelectorAll('.editInput')][0].focus();
    // console.log(values);
  }
  _saveEdit(e) {
    let values = [];
    const btn = e.target.closest('.saveBtn');
    if (!btn) return;
    // Check Workout Type
    const getWorkout = [e.target.closest('.editFlex').textContent][0].includes(
      'Running'
    );
    // get container to delete
    const container = e.target.closest('.editFlex').closest('li.workout');
    // Read new Inputs and Save
    const getInp = e.target
      .closest('.editFlex')
      .nextElementSibling.querySelectorAll('.editInput');
    // Save Inputs
    getInp.forEach(i => {
      values.push(+i.value);
      // console.log(values);
    });
    // console.log(container.dataset.id);

    let workout = this.#workouts.find(work => work.id === container.dataset.id);
    // Implement and display edited workout
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);
    const { lat, lng } = this.#mapEvent.latlng;

    if (getWorkout) {
      const [distance, duration, _, cadence] = values;
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        confirm.innerHTML = 'Inputs have to be positive numbers.';
        return confirm.classList.remove('hidden');
      }

      // alert('Inputs have to be positive numbers.');
      confirm.classList.add('hidden');
      workout.distance = distance;
      workout.duration = duration;
      workout.cadence = cadence;
      workout.pace = duration / distance;

      //   new Running([lat, lng], distance, duration, cadence);
    } else {
      const [distance, duration, _, elevation] = values;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        confirm.innerHTML = 'Inputs have to be positive numbers.';
        return confirm.classList.remove('hidden');
      }
      confirm.classList.add('hidden');
      //   return alert('Inputs have to be positive numbers.');
      workout.distance = distance;
      workout.duration = duration;
      workout.elevation = elevation;
      workout.speed = distance / (duration / 60);
    }
    container.style.display = 'none';
    this._renderWorkout(workout);
  }

  _deleteWorkout(e) {
    const btn = e.target.closest('.delete');
    if (!btn) return;
    const container = btn.closest('.editFlex').closest('li.workout');
    const index = this.#workouts.findIndex(
      work => work.id === container.dataset.id
    );

    this.#markers[index].remove();

    this.#markers.splice(index, 1);
    this.#workouts.splice(index, 1);
    // console.log(workout);
    container.classList.add('hidden');
    if (this.#workouts.length === 0) sideBtns.classList.add('hidden');
  }

  _sortByDate() {
    document
      .querySelectorAll('li.workout')
      .forEach(e => (e.style.display = 'none'));
    this.#workouts
      .sort((a, b) => a.date - b.date)
      .forEach(w => {
        this._renderWorkout(w);
      });
  }

  _sortByDistance() {
    document
      .querySelectorAll('li.workout')
      .forEach(e => (e.style.display = 'none'));
    this.#workouts
      .sort((a, b) => a.distance - b.distance)
      .forEach(w => {
        this._renderWorkout(w);
      });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload(); // programaticly reloading pages
  }
}

const app = new App();
//app.reset();
//app._getPosition();
if (module.hot) module.hot.accept();
