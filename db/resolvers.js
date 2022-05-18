const Usuario = require("../models/Usuario");
const Producto = require("../models/Producto");
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
    //Editar
    eliminarProducto: async (_, { id }) => {
      //revisar si existe
      let producto = await Producto.findById(id);
      if (!producto) throw new Error("Producto no encontrado");

      //eliminar
      await Producto.findOneAndDelete({ _id: id });
      return "Producto eliminado";
    },
  },
};

module.exports = resolvers;
