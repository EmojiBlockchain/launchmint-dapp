from flask import Flask, request, render_template, jsonify
import solcx
from solcx import compile_source
import json

app = Flask(__name__)

# Make sure solcx is installed
solcx.install_solc('0.8.0')


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/success')
def success():
    return render_template('success.html')

@app.route('/generate_contract', methods=['POST'])
def generate_contract():
    data = request.get_json()
    token_name = data['name']
    token_symbol = data['symbol']
    total_supply = data['supply']
    decimals = data.get('decimals', 18)

    # Load the contract template
    with open('contract_template.sol', 'r') as file:
        contract_template = file.read()

    # Inject user data into the contract
    contract_code = contract_template.replace('{{TOKEN_NAME}}', token_name)
    contract_code = contract_code.replace('{{TOKEN_SYMBOL}}', token_symbol)
    contract_code = contract_code.replace('{{DECIMALS}}', str(decimals))
    contract_code = contract_code.replace('{{TOTAL_SUPPLY}}', total_supply)

    # Compile the contract
    compiled = compile_source(contract_code, output_values=['abi', 'bin'], solc_version='0.8.0')
    contract_id, contract_interface = compiled.popitem()

    abi = contract_interface['abi']
    bytecode = contract_interface['bin']

    return jsonify({'abi': abi, 'bytecode': bytecode})


if __name__ == '__main__':
    app.run(debug=True)
