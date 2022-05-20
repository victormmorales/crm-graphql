const Usuario = require("../models/Usuario");
const Producto = require("../models/Producto");
const Cliente = require("../models/Cliente");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "variables.env" });

const crearToken = (usuario, secreta, expiresIn) => {
  const { id, email, nombre, apellido } = usuario;

  return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn });
};

const resolvers = {
  Query: {
    obtenerUsuario: async (_, { token }) => {
      const usuarioId = await jwt.verify(token, process.env.SECRETA);

      return usuarioId;
    },
    obtenerProductos: async () => {
      try {
        const productos = await Producto.find({});
        return productos;
      } catch (error) {
        console.log("ERROR =>", error);
      }
    },
    obtenerProducto: async (_, { id }) => {
      //revisar si producto existe
      const producto = await Producto.findById(id);
      if (!producto) throw new Error("Producto no encontrado");

      return producto;
    },
    obtenerClientes: async () => {
      try {
        const clientes = await Cliente.find({});
        return clientes;
      } catch (error) {
        console.log("ERROR =>", error);
      }
    },
    obtenerClientesVendedor: async (_, {}, ctx) => {
      try {
        const clientes = await Cliente.find({ vendedor: ctx.usuario.id });
        return clientes;
      } catch (error) {
        console.log("ERROR =>", error);
      }
    },
    obtenerCliente: async (_, { id }, ctx) => {
      //revisar si existe
      const cliente = await Cliente.findById(id);
      if (!cliente) throw new Error("Cliente no encontrado");

      //quien lo creo puede verlo
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      return cliente;
    },
  },
  Mutation: {
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input;

      //revisar si user está registrado
      const existeUsuario = await Usuario.findOne({ email });
      if (existeUsuario) {
        throw new Error("El usuario ya está registrado");
      }

      //hashear password
      const salt = await bcryptjs.genSalt(10);
      input.password = await bcryptjs.hash(password, salt);

      try {
        //guardarlo en DB
        const usuario = new Usuario(input);
        usuario.save(); //guardarlo

        return usuario;
      } catch (error) {
        console.log("ERROR =>", error);
      }
    },
    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input;

      //si usuario existe
      const existeUsuario = await Usuario.findOne({ email });
      if (!existeUsuario) {
        throw new Error("El usuario no existe");
      }

      //revisar password correcto
      const passwordCorrecto = await bcryptjs.compare(
        password,
        existeUsuario.password
      );
      if (!passwordCorrecto) {
        throw new Error("La contraseña es incorrecta");
      }

      // crear token
      return {
        token: crearToken(existeUsuario, process.env.SECRETA, "24h"),
      };
    },
    nuevoProducto: async (_, { input }) => {
      try {
        const producto = new Producto(input);

        //almacenar en DB
        const resultado = await producto.save();
        return resultado;
      } catch (error) {
        console.log("ERROR =>", error);
      }
    },
    actualizarProducto: async (_, { id, input }) => {
      let producto = Producto.findById(id);
      if (!producto) throw new Error("Producto no encontrado");

      //guardar en DB
      producto = await Producto.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return producto;
    },
    eliminarProducto: async (_, { id }) => {
      //revisar si existe
      let producto = await Producto.findById(id);
      if (!producto) throw new Error("Producto no encontrado");

      //eliminar
      await Producto.findOneAndDelete({ _id: id });
      return "Producto eliminado";
    },
    nuevoCliente: async (_, { input }, ctx) => {
      console.log(ctx);
      const { email } = input;

      //verificar cliente esta registrado
      const cliente = await Cliente.findOne({ email });
      if (cliente) throw new Error("Cliente ya registrado");

      const nuevoCliente = new Cliente(input);

      //asignar vendedor
      nuevoCliente.vendedor = ctx.usuario.id;

      //guardar DB
      try {
        const resultado = await nuevoCliente.save();

        return resultado;
      } catch (error) {
        console.log("ERROR =>", error);
      }
    },
    actualizarCliente: async (_, { id, input }, ctx) => {
      //verificar si existe
      let cliente = await Cliente.findById(id);
      if (!cliente) throw new Error("Ese cliente no existe");

      //verificar si el vendedor es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      //guardarcliente
      cliente = await Cliente.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return cliente;
    },
    eliminarCliente: async (_, { id }, ctx) => {
      //verificar si existe
      let cliente = await Cliente.findById(id);
      if (!cliente) throw new Error("Ese cliente no existe");

      //verificar si el vendedor es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      //eliminar cliente
      await Cliente.findOneAndDelete({ _id: id });
      return "Cliente eliminado";
    },
    nuevoPedido: async (_, { input }, ctx) => {
      const { cliente } = input;

      //verificar si cliente existe
      let clienteExiste = await Cliente.findById(cliente);
      if (!clienteExiste) throw new Error("El cliente no existe");

      //verificar si cliente es del vendedor
      if (clienteExiste.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      //revisar hay stock
      //asignar vendedor
      //guardar BD
    },
  },
};

module.exports = resolvers;
