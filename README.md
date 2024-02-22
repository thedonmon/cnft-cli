#### CNFT Cli & Tools Solana

## Intro

Cli tool using the latest `Umi` framework from metaplex to handling minting and updating cNFTs on Solana. Still a work in progress. Please feel free to contribute!

## Sources

- [Umi](https://github.com/metaplex-foundation/umi/tree/main)
- [Metaplex Docs](https://developers.metaplex.com/bubblegum)

## Install

1. Install [node.js](https://nodejs.org/en/download/), [yarn](https://yarnpkg.com/getting-started/install) (or use npm).
2. Clone this repository, and using a terminal navigate to its directory.
3. Run `yarn` or `npm install` to install the dependencies.

## Build & Run

1. Copy the contents of the `.env.example` file to a `.env` next to it, and edit it with your values.
2. Run `yarn cli <cmdname> -args`

#### Usage

To interact with the CNFT CLI, you can use the following commands. Make sure you have set up your environment correctly as per the installation instructions.

### Commands

1. **Create LUT (Lookup Table)**

   Create a new LUT or CNFT LUT with specified addresses.

   ```bash
   yarn cli createLUT -a <path-to-addresses> [--cnft]
   ```

   - `-a, --addresses <path>`: Path to a JSON file containing addresses to add to LUT.
   - `--cnft`: Optional flag to create a CNFT LUT.

2. **Extend LUT**

   Extend an existing LUT with additional addresses.

   ```bash
   yarn cli extendLUT -a <path-to-addresses> -l <LUT-address>
   ```

   - `-a, --addresses <path>`: Path to a JSON file containing addresses to add.
   - `-l, --lut <string>`: LUT address to extend.

3. **Create Collection**

   Create a new CNFT collection.

   ```bash
   yarn cli createCollection -n <name> -s <symbol> -d <description> -i <imagePath> [-ex <externalUrl>] [-l <lutAddress>]
   ```

   - `-n, --name <string>`: Collection name.
   - `-s, --symbol <string>`: Collection symbol.
   - `-d, --description <string>`: Collection description.
   - `-i, --imagePath <string>`: Path to the collection image.
   - `-ex, --externalUrl <string>`: External URL (optional).
   - `-l, --lut <string>`: LUT address (optional).

4. **Fetch CNFTs**

   Fetch CNFTs by collection or owner.

   ```bash
   yarn cli fetchCnfts -co <collectionAddress> [-ow <ownerAddress>] [--no-paginate]
   ```

   - `-co, --collection <string>`: Collection address of the CNFT.
   - `-ow, --owner <string>`: Owner address to fetch CNFTs (optional).
   - `--no-paginate`: Do not paginate all results. Returns 1000 max (optional).

5. **Search CNFTs**

   Search CNFTs by collection or owner.

   ```bash
   yarn cli search -co <collectionAddress> [-ow <ownerAddress>] [--no-paginate] [--no-compressed]
   ```

   - `-co, --collection <string>`: Collection address of the CNFT.
   - `-ow, --owner <string>`: Owner address to fetch CNFTs (optional).
   - `--no-paginate`: Do not paginate all results. Returns 1000 max (optional).
   - `--no-compressed`: Search non-compressed assets (optional).

### Additional Options

Most commands support the following additional options:

- `-e, --env <string>`: Solana cluster env name (default: devnet).
- `-k, --keypair <path>`: Solana wallet location. This option is mandatory for commands that require a wallet.
- `-r, --rpc <string>`: Custom RPC URL.
- `--no-log`: Do not log results to outfile (default: true).

### Examples

Create a new LUT with addresses from a file:

```bash
yarn cli createLUT -a ./addresses.json
```

Create a new CNFT collection:

```bash
yarn cli createCollection -n "My Collection" -s "MYC" -d "This is my collection." -i ./image.png
```

Search CNFTs by owner:

```bash
yarn cli search -ow H3tJWnY9Wm6pF3V9LzZ3ZhVFeXgE8YkiGd6zGR4gX6G
```

## Run with Docker

1. Build:

    ```
    docker build -t my-app .
    ```

    Replacing `my-app` with the image name.

2. Run
    ```
    docker run -d -p 3000:3000 my-app
    ```
    Replacing `my-app` with the image name, and `3000:3000` with the `host:container` ports to publish.

## Developing

### Visual Studio Code

-   Installing the Eslint (`dbaeumer.vscode-eslint`) and Prettier - Code formatter (`esbenp.prettier-vscode`) extensions is recommended.

## Linting & Formatting

-   Run `yarn lint` or `npm lint` to lint the code.
-   Run `yarn format` or `npm format` to format the code.

## Testing

Check the placeholder test examples to get started : 

- `/src/app.ts` that provide a function `sum` 
- `/test/app.spec.ts` who test the `sum` function 

This files are just an example, feel free to remove it

-   Run `yarn test` or `npm test` to execute all tests.
-   Run `yarn test:watch` or `npm test:watch` to run tests in watch (loop) mode.
-   Run `yarn test:coverage` or `npm test:coverage` to see the tests coverage report.
