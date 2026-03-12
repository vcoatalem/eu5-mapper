# EU5 Mapper

> After playing a few hundred hours over the past few months, it became apparent that proximity is one of the most important values in the game. However, I've always been frustrated by the opacity of the concept. How much value is this road actually bringing me? How much does 0.2 harbor suitability help with proximity? Would A be a better capital location than B? Ironman preventing save / reload made this feeling even more prevalent, leading to either decision paralysis or YOLO-ing and hoping for the best.

EU5 Mapper is a data visualization web application for EU5 which aims to be both a "build planner" and game companion to help with decision making.

**Important point: the project is very much not done yet. It is a RAM hog and not particularily pretty. However even in this unfinished state, I think it might be useful to some folks.**

Check it out here ! https://www.eu5mapper.com/

## Open Source

Contributions are very much welcome - feel free to fork the project and send me PRs if you think you can make worthwile additions !

If you wish to really dig into the project, feel free to [contact me](mailto:contact@victorcoatalem.com) - I can add you as contributor.

**Contribution on the following matters would be particularily appreciated:**

### 1. Loading save file from EU5

Obvious killer feature, but not sure how feasible; [pdx unlimiter](https://github.com/crschnick/pdx_unlimiter) might be a good lead.

### 2. Memory Usage / Performance

As of today, the app used multiple GB worth of RAM to display the world map. That is simply not good enough, and causes crash / restart on lower end machines or Safari Browser.

### 3. Game fidelity control

The test suite in `test/pathfinding` allows to automatically test fidelity of eu5mapper with eu5.exe.
It essentially compares reference proximity data manually collected from the game, with the results of the pathfinding algorithm.

This is critical to ensure game mechanics are properly implemented.

The way reference file (e.g [this one](/tests/pathfinding/references/1.0.11/eng_1_0_11.csv)) are created, is by starting a new game in 1337 and noting proximity of each location of that country in the csv file matching the format.

CSV files added in the `test/pathfinding/references` folder will be automatically be picked up and ran by the test suite in the CI.

## Running the project locally

```shell
# install packages

npm i

# run locally

npm run dev

# app will be available on localhost:3000

```

In another terminal, run the following:

```shell

npm run build:workers:watch

# Compiles workers in watch-mode

```

Web workers handle both the pathfinding algorithm, and color search algorithm (which is how the app knows which pixels belong to which game location). So, don't forget to launch them as otherwise pretty much nothing will work.

## Running test suite

```shell
npm run test

# This will run pathfinding test for all reference files found in `tests/pathfinding/references`
```

## Modifying game data

The game data is refined through multiple ETL pipelines from a [dedicated repository](https://github.com/vcoatalem/eu5-mapapp-data-processing) and served to EU5Mapper through a CDN.

This repository is not open source yet, but if you wish to know more about it or take a look at it, feel free to [contact me](mailto:contact@victorcoatalem.com).
