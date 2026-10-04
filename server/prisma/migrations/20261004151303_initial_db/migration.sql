-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fName" TEXT NOT NULL,
    "lName" TEXT NOT NULL,
    "nationalities" TEXT[],
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firsTime" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quiz_responses" (
    "id" TEXT NOT NULL,
    "bookedTransportation" JSONB,
    "transportationPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bookedAccommodations" JSONB,
    "accommodationPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bookedExperiences" JSONB,
    "startCity" TEXT,
    "startCountry" TEXT,
    "prferredCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredMonths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredMinDuration" INTEGER,
    "preferredMaxDuration" INTEGER,
    "preferredTemperature" TEXT,
    "preferredWeather" TEXT,
    "visaWillingness" BOOLEAN,
    "riskTolerance" INTEGER,
    "resultCountry" TEXT,
    "travelAlterEgo" TEXT NOT NULL,
    "viewsPhotos" TEXT NOT NULL,
    "postPhotos" TEXT NOT NULL,
    "sleepIn" BOOLEAN NOT NULL,
    "famousLocation" BOOLEAN NOT NULL,
    "seeItAll" BOOLEAN NOT NULL,
    "peoplePerson" BOOLEAN NOT NULL,
    "walkAmount" TEXT NOT NULL,
    "numPeople" INTEGER NOT NULL,
    "budget" TEXT NOT NULL,
    "dietaryRestrictions" TEXT[],

    CONSTRAINT "user_quiz_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_trips" (
    "userId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "itinerary" JSONB NOT NULL,

    CONSTRAINT "saved_trips_pkey" PRIMARY KEY ("tripId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "user_quiz_responses" ADD CONSTRAINT "user_quiz_responses_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_trips" ADD CONSTRAINT "saved_trips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
